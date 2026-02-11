Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]: [2026-02-11T09:59:05.351+0300] {views.py:363} INFO - Rendering file browser template
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]: [2026-02-11T09:59:05.352+0300] {views.py:349} INFO - User permissions: {'can_read': True, 'can_edit': True, 'can_create_file': True, 'can_create_folder': True, 'can_delete': True, 'can_rename': True, 'can_download': True}
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]: [2026-02-11T09:59:05.364+0300] {app.py:1744} ERROR - Exception on /dagmanager/ [GET]
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]: Traceback (most recent call last):
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask/app.py", line 2529, in wsgi_app
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     response = self.full_dispatch_request()
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask/app.py", line 1825, in full_dispatch_request
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     rv = self.handle_user_exception(e)
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask/app.py", line 1823, in full_dispatch_request
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     rv = self.dispatch_request()
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask/app.py", line 1799, in dispatch_request
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     return self.ensure_sync(self.view_functions[rule.endpoint])(**view_args)
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask_appbuilder/security/decorators.py", line 137, in wraps
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     return f(self, *args, **kwargs)
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/airflow/www/decorators.py", line 132, in wrapper
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     return f(*args, **kwargs)
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/app/airflow/v28/plugins/dag_manager/views.py", line 365, in index
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     return self.render_template(
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask_appbuilder/baseviews.py", line 342, in render_template
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     return render_template(
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask/templating.py", line 147, in render_template
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     return _render(app, template, context)
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask/templating.py", line 130, in _render
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     rv = template.render(context)
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/jinja2/environment.py", line 1301, in render
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     self.environment.handle_exception()
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/jinja2/environment.py", line 936, in handle_exception
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     raise rewrite_traceback_stack(source=source)
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/app/airflow/v28/plugins/dag_manager/templates/file_browser.html", line 1, in top-level template code
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     {% extends 'airflow/main.html' %}
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/airflow/www/templates/airflow/main.html", line 21, in top-level template code
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     {% from 'airflow/_messages.html' import show_message %}
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask_appbuilder/templates/appbuilder/baselayout.html", line 2, in top-level template code
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     {% import 'appbuilder/baselib.html' as baselib %}
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask_appbuilder/templates/appbuilder/init.html", line 18, in top-level template code
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     {% block head_css %}
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/app/airflow/v28/plugins/dag_manager/templates/file_browser.html", line 7, in block 'head_css'
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     <link rel="stylesheet" href="{{ url_for('dag_manager_blueprint.static', filename='css/dag_manager.css') }}">
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask/app.py", line 2034, in url_for
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     return self.handle_url_build_error(error, endpoint, values)
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/flask/app.py", line 2023, in url_for
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     rv = url_adapter.build(  # type: ignore[union-attr]
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:   File "/home/airflow/v28/.local/lib/python3.10/site-packages/werkzeug/routing/map.py", line 917, in build
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]:     raise BuildError(endpoint, values, method, self)
Feb 11 09:59:05 SPB99-ARF-AP04T airflow-webserver-v28[1127128]: werkzeug.routing.exceptions.BuildError: Could not build url for endpoint 'dag_manager_blueprint.static' with values ['filename']. Did you mean 'dag_manager.static' instead?
^C
root@SPB99-ARF-AP04T:/app/airflow/v28/plugins/dag_manager#
