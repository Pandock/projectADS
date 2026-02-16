"""DAG Manager Plugin for Apache Airflow"""

import os
from flask import Blueprint
from airflow.plugins_manager import AirflowPlugin
from dag_manager.views import DagManagerView


dag_manager_bp = Blueprint(
    "dag_manager_blueprint",
    __name__,
    static_folder="static",
    static_url_path="/static/dag_manager"
)


class DagManagerPlugin(AirflowPlugin):
    name = "dag_manager"

    flask_blueprints = [dag_manager_bp]

    appbuilder_views = [
        {
            "name": "DAG manage",
            "category": "Admin",
            "view": DagManagerView()
        }
    ]
