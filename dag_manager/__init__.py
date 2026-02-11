"""DAG Manager Plugin for Apache Airflow 2.8"""

import os
from flask import Blueprint
from airflow.plugins_manager import AirflowPlugin
from dag_manager.views import DagManagerView


# Создаем Blueprint для статических файлов
dag_manager_bp = Blueprint(
    "dag_manager",
    __name__,
    static_folder="static",
    static_url_path="/static/dag_manager"
)


class DagManagerPlugin(AirflowPlugin):
    """Plugin for managing DAG files through web interface"""
    name = "dag_manager"

    # Регистрируем blueprint для статики
    flask_blueprints = [dag_manager_bp]

    appbuilder_views = [
        {
            "name": "DAG manage",  # ИСПРАВЛЕНИЕ: Изменено название в меню
            "category": "Admin",
            "view": DagManagerView()
        }
    ]
