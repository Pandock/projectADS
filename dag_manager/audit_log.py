import logging
import re
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Integer, String, DateTime, Text, create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from sqlalchemy.exc import ProgrammingError, OperationalError
from airflow.configuration import conf

logger = logging.getLogger(__name__)

Base = declarative_base()


class DagManagerAuditLog(Base):
    __tablename__ = 'dag_manager_audit_log'

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    username = Column(String(250), nullable=False)
    action = Column(String(50), nullable=False)
    object_path = Column(Text, nullable=False)
    result = Column(String(500), nullable=False)
    mount = Column(String(100), nullable=True)

    def __repr__(self):
        return f"AuditLog({self.timestamp}, {self.username}, {self.action}, {self.object_path})"


class AuditLogger:

    def __init__(self):
        self.enabled = False
        self.engine = None
        self.Session = None
        self.schema = None
        self.initialize()

    def _get_db_type(self, connection_string: str) -> str:
        if connection_string.startswith('postgresql'):
            return 'postgresql'
        elif connection_string.startswith('mysql'):
            return 'mysql'
        elif connection_string.startswith('sqlite'):
            return 'sqlite'
        else:
            return 'unknown'

    def _validate_schema_name(self, schema: str) -> str:
        if not schema:
            raise ValueError("Schema name cannot be empty")

        if not re.match(r'^[a-z_][a-z0-9_]*$', schema, re.IGNORECASE):
            raise ValueError(f"DAG Manager: Invalid schema name: '{schema}'. Only letters, numbers, and underscores allowed.")

        if len(schema) > 63:  # PostgreSQL identifier limit
            raise ValueError(f"DAG Manager: Schema name too long: {len(schema)} chars (max 63)")

        logger.info(f"DAG Manager: Validated schema name: {schema}")
        return schema

    def _create_schema_if_not_exists(self, connection_string: str, schema: str):
        if not schema:
            return

        db_type = self._get_db_type(connection_string)

        if db_type != 'postgresql':
            logger.debug(f"DAG Manager: Schema creation not needed for {db_type}")
            return

        try:
            safe_schema = self._validate_schema_name(schema)

            temp_engine = create_engine(connection_string, poolclass=NullPool)

            with temp_engine.connect() as conn:
                result = conn.execute(
                    text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema"),
                    {"schema": safe_schema}
                )

                if not result.fetchone():
                    quoted_schema = conn.dialect.identifier_preparer.quote(safe_schema)

                    conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {quoted_schema}"))
                    conn.commit()
                    logger.info(f"DAG Manager: Created schema '{safe_schema}' for audit logs")
                else:
                    logger.debug(f"DAG Manager: Schema '{safe_schema}' already exists")

            temp_engine.dispose()

        except ValueError as e:
            logger.error(f"DAG Manager: Schema name validation failed: {e}")
            raise
        except Exception as e:
            logger.warning(f"DAG Manager: Could not create schema '{schema}': {e}")

    def _create_table_if_not_exists(self):
        try:
            inspector = inspect(self.engine)

            if self.schema:
                table_exists = inspector.has_table('dag_manager_audit_log', schema=self.schema)
            else:
                table_exists = inspector.has_table('dag_manager_audit_log')

            if not table_exists:
                Base.metadata.create_all(self.engine)
                logger.info(
                    f"Created audit log table 'dag_manager_audit_log'"
                    f"{f' in schema {self.schema}' if self.schema else ''}"
                )
            else:
                logger.debug(
                    f"Audit log table already exists"
                    f"{f' in schema {self.schema}' if self.schema else ''}"
                )

        except Exception as e:
            logger.error(f"DAG Manager: Failed to create audit log table: {e}", exc_info=True)
            raise

    def initialize(self):
        try:
            if conf.has_option("dag_manager", "logs_to_database"):
                self.enabled = conf.getboolean("dag_manager", "logs_to_database")
            else:
                self.enabled = False

            if not self.enabled:
                logger.info("Database audit logging is disabled")
                return

            connection_string = None
            if conf.has_option("dag_manager", "logs_db_connection_string"):
                connection_string = conf.get("dag_manager", "logs_db_connection_string")

            if not connection_string:
                connection_string = conf.get("database", "sql_alchemy_conn")
                logger.info("Using Airflow database connection for audit logs")
            else:
                logger.info("Using custom database connection for audit logs")

            # Get schema from config
            if conf.has_option("dag_manager", "logs_db_schema"):
                self.schema = conf.get("dag_manager", "logs_db_schema")
                logger.info(f"DAG Manager: Using schema '{self.schema}' for audit logs")
                
                DagManagerAuditLog.__table__.schema = self.schema

            if self.schema:
                self._create_schema_if_not_exists(connection_string, self.schema)

            self.engine = create_engine(
                connection_string,
                poolclass=NullPool,
                echo=False
            )

            self._create_table_if_not_exists()

            self.Session = sessionmaker(bind=self.engine)

            logger.info("Audit logging to database initialized successfully")

        except Exception as e:
            logger.error(f"DAG Manager: Failed to initialize audit logging: {e}", exc_info=True)
            self.enabled = False

    def log(
        self,
        username: str,
        action: str,
        object_path: str,
        result: str,
        mount: Optional[str] = None
    ):
        if not self.enabled or not self.Session:
            return

        session: Session = None
        try:
            session = self.Session()

            log_entry = DagManagerAuditLog(
                timestamp=datetime.utcnow(),
                username=username,
                action=action,
                object_path=object_path,
                result=result,
                mount=mount
            )

            session.add(log_entry)
            session.commit()

            logger.debug(f"DAG Manager: Audit log written: {username} - {action} - {object_path} - {result}")

        except Exception as e:
            logger.error(f"DAG Manager: Failed to write audit log: {e}", exc_info=True)
            if session:
                session.rollback()
        finally:
            if session:
                session.close()

    def log_action(self, username: str, action: str, path: str, result: str, mount: str):
        self.log(username, action, path, result, mount)

    def log_security_event(self, username: str, event_type: str, ip_address: Optional[str] = None):
        if not ip_address:
            from flask import request
            try:
                ip_address = request.remote_addr
            except:
                ip_address = "unknown"

        self.log(
            username=username,
            action='SECURITY_EVENT',
            object_path=ip_address,
            result='BLOCKED'
        )

        logger.warning(f"DAG Manager: SECURITY EVENT: {event_type} by {username} from {ip_address}")


audit_logger = AuditLogger()
