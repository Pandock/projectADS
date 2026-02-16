DAG Manager Plugin - Configuration Guide
Overview
DAG Manager Plugin provides a file browser interface for managing DAG files in Apache Airflow. This document describes all available configuration options.

Configuration Sections
All configuration options are added to airflow.cfg under the [dag_manager] section.

1. Mount Points
Mount points define which directories are accessible through the DAG Manager interface.

Configuration
text
[dag_manager]
# Define custom mount points
# Format: mount_<name> = /path/to/directory

mount_dags = /opt/airflow/dags
mount_plugins = /opt/airflow/plugins
mount_include = /opt/airflow/include
Default Behavior
If no mount points are configured, the plugin will use the default DAGs folder from core.dags_folder.

Example
text
[dag_manager]
mount_dags = /opt/airflow/dags
mount_shared = /mnt/shared_dags
mount_temp = /tmp/dag_development
2. Audit Logging to Database
The plugin can log all file operations (create, delete, rename, modify, download) to a database table for audit purposes.

Configuration Options
text
[dag_manager]
# Enable/disable database audit logging
# Default: false
logs_to_database = true

# Database connection string (optional)
# If not specified, uses Airflow's main database connection
logs_db_connection_string = postgresql+psycopg2://user:password@host:5432/airflow

# Database schema name (optional)
# If not specified, uses default schema
logs_db_schema = public
Configuration Examples
Example 1: Use Airflow's Database (Recommended)
text
[dag_manager]
logs_to_database = true
# No connection string specified - will use Airflow's database
# No schema specified - will use default schema
The plugin will automatically use the connection string from [database] sql_alchemy_conn.

Example 2: Custom Database Connection
text
[dag_manager]
logs_to_database = true
logs_db_connection_string = postgresql+psycopg2://audit:password@audit-db:5432/audit_logs
logs_db_schema = dag_manager_audit
Example 3: Custom Schema in Airflow Database
text
[dag_manager]
logs_to_database = true
logs_db_schema = audit
Example 4: Disabled Logging (Default)
text
[dag_manager]
logs_to_database = false
Or simply don't add the logs_to_database parameter at all.

3. Complete Configuration Example
text
[dag_manager]
# Mount points
mount_dags = /opt/airflow/dags
mount_plugins = /opt/airflow/plugins
mount_include = /opt/airflow/include
mount_shared = /mnt/shared_storage

# Audit logging
logs_to_database = true
logs_db_schema = audit



Database Audit Log Table
Table Structure
When logs_to_database = true, the plugin automatically creates the following table:

sql
CREATE TABLE dag_manager_audit_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    username VARCHAR(250) NOT NULL,
    action VARCHAR(50) NOT NULL,
    object_type VARCHAR(20) NOT NULL,
    object_path TEXT NOT NULL,
    result VARCHAR(50) NOT NULL,
    details TEXT,
    mount VARCHAR(100)
);

CREATE INDEX idx_audit_timestamp ON dag_manager_audit_log(timestamp);
CREATE INDEX idx_audit_username ON dag_manager_audit_log(username);
CREATE INDEX idx_audit_action ON dag_manager_audit_log(action);
Column Descriptions
Column	Type	Description
id	Integer	Primary key, auto-increment
timestamp	Timestamp	When the action occurred (UTC)
username	String(250)	Airflow username who performed the action
action	String(50)	Action type: CREATE_FILE, CREATE_FOLDER, DELETE, RENAME, MODIFY, DOWNLOAD
object_type	String(20)	Type of object: file or folder
object_path	Text	Full path to the object (relative to mount point)
result	String(50)	Result: SUCCESS, ERROR, DELETED, MODIFIED, RENAMED, DOWNLOADED
details	Text	Additional details (new path for rename, error message, etc.)
mount	String(100)	Mount point name
Action Types
Action	Description	Object Type	Result Values
CREATE_FILE	New file created	file	SUCCESS, ERROR
CREATE_FOLDER	New folder created	folder	SUCCESS, ERROR
DELETE	File or folder deleted	file / folder	DELETED, ERROR
RENAME	File or folder renamed	file / folder	RENAMED, ERROR
MODIFY	File content modified	file	MODIFIED, ERROR
DOWNLOAD	File or folder downloaded	file / folder	DOWNLOADED, ERROR
Example Queries
View all actions by user
sql
SELECT timestamp, action, object_type, object_path, result
FROM dag_manager_audit_log
WHERE username = 'admin'
ORDER BY timestamp DESC
LIMIT 100;
View all file modifications
sql
SELECT timestamp, username, object_path, details
FROM dag_manager_audit_log
WHERE action = 'MODIFY'
ORDER BY timestamp DESC;
View all deletions in the last 24 hours
sql
SELECT timestamp, username, object_type, object_path, mount
FROM dag_manager_audit_log
WHERE action = 'DELETE'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
View all errors
sql
SELECT timestamp, username, action, object_path, details
FROM dag_manager_audit_log
WHERE result = 'ERROR'
ORDER BY timestamp DESC;
Count actions by user
sql
SELECT username, action, COUNT(*) as count
FROM dag_manager_audit_log
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY username, action
ORDER BY count DESC;
Syslog Logging
In addition to database logging, all operations are logged to syslog (standard Airflow logs).

Log Format
text
[timestamp] {module:line} LEVEL - User '<username>' <action>: mount=<mount>, path=<path>
Example Syslog Entries
text
[2026-02-12T15:30:45.123+0300] {views.py:450} INFO - User 'admin' created file: mount=dags, path=new_dag.py
[2026-02-12T15:31:12.456+0300] {views.py:520} INFO - User 'admin' modified file: mount=dags, path=new_dag.py (1234 chars)
[2026-02-12T15:32:01.789+0300] {views.py:600} INFO - User 'admin' renamed file: mount=dags, old_path=new_dag.py, new_path=production_dag.py
[2026-02-12T15:33:45.012+0300] {views.py:680} INFO - User 'devops' deleted file: mount=dags, path=old_dag.py
[2026-02-12T15:34:20.345+0300] {views.py:350} INFO - User 'admin' downloading file: mount=dags, path=production_dag.py
View Logs
To view DAG Manager logs:

bash
# View webserver logs
tail -f $AIRFLOW_HOME/logs/dag_processor_manager/dag_processor_manager.log

# Or use journalctl if Airflow runs as systemd service
journalctl -u airflow-webserver -f | grep "dag_manager"

Admin → Security → List Roles → Edit Role

Available Permissions
Permission	Description
menu access on DAG File Browser	Access to DAG Manager menu item
can_index on DagManagerView	View the main page
can_api_tree on DagManagerView	View folder tree
can_api_contents on DagManagerView	View folder contents
can_api_file on DagManagerView	Read file contents
can_api_create_file on DagManagerView	Create new files
can_api_create_folder on DagManagerView	Create new folders
can_api_delete on DagManagerView	Delete files and folders
can_api_rename on DagManagerView	Rename files and folders
can_api_save_file on DagManagerView	Edit and save file contents
can_api_download on DagManagerView	Download files and folders
Example Role Configuration
Read-Only Role
text
☑ menu access on DAG File Browser
☑ can_index on DagManagerView
☑ can_api_tree on DagManagerView
☑ can_api_contents on DagManagerView
☑ can_api_file on DagManagerView
☑ can_api_download on DagManagerView
☐ can_api_create_file on DagManagerView
☐ can_api_create_folder on DagManagerView
☐ can_api_delete on DagManagerView
☐ can_api_rename on DagManagerView
☐ can_api_save_file on DagManagerView
Full Access Role (DevOps)
text
☑ All permissions
Troubleshooting
Issue: "Database audit logging is disabled"
Solution: Add to airflow.cfg:

text
[dag_manager]
logs_to_database = true
Then restart Airflow webserver.

Issue: "Failed to initialize audit logging"
Possible causes:

Invalid database connection string

Database user lacks permissions to create tables

Schema doesn't exist

Solution:

Check connection string format

Ensure database user has CREATE TABLE permissions

Create schema manually if needed:

sql
CREATE SCHEMA IF NOT EXISTS your_schema_name;
GRANT ALL ON SCHEMA your_schema_name TO airflow_user;
Issue: Table not created automatically
Solution: Create table manually:

sql
-- PostgreSQL
CREATE TABLE IF NOT EXISTS dag_manager_audit_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    username VARCHAR(250) NOT NULL,
    action VARCHAR(50) NOT NULL,
    object_type VARCHAR(20) NOT NULL,
    object_path TEXT NOT NULL,
    result VARCHAR(50) NOT NULL,
    details TEXT,
    mount VARCHAR(100)
);

CREATE INDEX idx_dag_audit_timestamp ON dag_manager_audit_log(timestamp);
CREATE INDEX idx_dag_audit_username ON dag_manager_audit_log(username);
CREATE INDEX idx_dag_audit_action ON dag_manager_audit_log(action);

-- MySQL
CREATE TABLE IF NOT EXISTS dag_manager_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(250) NOT NULL,
    action VARCHAR(50) NOT NULL,
    object_type VARCHAR(20) NOT NULL,
    object_path TEXT NOT NULL,
    result VARCHAR(50) NOT NULL,
    details TEXT,
    mount VARCHAR(100),
    INDEX idx_dag_audit_timestamp (timestamp),
    INDEX idx_dag_audit_username (username),
    INDEX idx_dag_audit_action (action)
);
Issue: Logs not appearing in database
Checklist:

logs_to_database = true in config?

Airflow webserver restarted after config change?

Check webserver logs for errors:

bash
grep "audit" $AIRFLOW_HOME/logs/scheduler/latest/*.log
Test database connection manually:

python
from airflow.configuration import conf
print(conf.get("database", "sql_alchemy_conn"))
Security Considerations
File Access Control
The plugin respects the following security measures:

Path Traversal Protection: Prevents access to files outside mount points

Hidden Files: Automatically skips hidden files and system directories (.git, __pycache__, etc.)

Filename Validation: Only allows safe characters in filenames (letters, digits, spaces, -, _, ., (), ,, +)

Role-Based Access Control: All operations require appropriate Airflow permissions

Audit Trail
Enable database logging to maintain a complete audit trail:

text
[dag_manager]
logs_to_database = true
This creates an immutable record of all file operations for compliance and forensics.

Recommended Practices
Separate Audit Database: Use a dedicated database for audit logs

Regular Backups: Back up audit logs regularly

Access Restrictions: Limit database access to administrators only

Log Retention: Implement log retention policies based on compliance requirements

Migration from Previous Versions
Updating from Version without Audit Logging
Add configuration to airflow.cfg:

text
[dag_manager]
logs_to_database = true
Restart Airflow webserver:

bash
airflow webserver --daemon
Table will be created automatically on first operation

Updating Permissions
After updating the plugin, permissions may have changed. Update roles:

Go to Admin → Security → List Roles

Edit each role that uses DAG Manager

Remove old permissions:

menu access on Dag Manager (old name)

can_api_create on DagManagerView (split into two)

Add new permissions:

menu access on DAG File Browser (new name)

can_api_create_file on DagManagerView

can_api_create_folder on DagManagerView

Support
For issues or questions, check:

Airflow webserver logs

Database logs for connection issues

Airflow RBAC configuration

Changelog
Version 2.0 (2026-02-12)
Added database audit logging

Improved syslog logging with usernames

Split can_api_create into can_api_create_file and can_api_create_folder

Renamed plugin from "Dag Manager" to "DAG File Browser"

Version 1.0 (Initial Release)
Basic file browser functionality

Create, delete, rename, edit files and folders

Download files and folders

Role-based permissions




[dag_manager]
# Mount points (опционально, если нужны дополнительные папки)
mount_dags = /opt/airflow/dags
mount_plugins = /opt/airflow/plugins

# Audit logging в базу данных
logs_to_database = true
# logs_db_connection_string =  # Оставьте закомментированным чтобы использовать БД Airflow
# logs_db_schema = public       # Опционально: кастомная схема



[dag_manager]
mount_dags = /opt/airflow/dags
mount_plugins = /opt/airflow/plugins
mount_include = /opt/airflow/include
mount_shared = /mnt/shared_storage

logs_to_database = true
logs_db_schema = audit
