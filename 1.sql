-- Создание таблицы test_mnt в схеме cmdb
CREATE TABLE IF NOT EXISTS cmdb.test_mnt (
    produkt                    TEXT,
    gruppa                     TEXT,
    it_sistema                 TEXT,
    komponent                  TEXT,
    tip_unit                   TEXT,
    server                     TEXT,
    naimenovanie_unit          TEXT,
    vliyaet_na_polzovateley    TEXT,
    vliyaet_na_osnovnuyu_funky TEXT
);

-- INSERT всех строк (без столбцов Примечание и признак отказа)
INSERT INTO cmdb.test_mnt (produkt, gruppa, it_sistema, komponent, tip_unit, server, naimenovanie_unit, vliyaet_na_polzovateley, vliyaet_na_osnovnuyu_funky) VALUES
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Nginx (планируем)', 'system', 'spb99-arf-ap04t', 'nginx', 'Да', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Scheduler', 'system', 'spb99-arf-ap04t', 'airflow-scheduler-v28.service', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'MetaDatabase', 'system', 'spb99-arf-ap04t', 'spb99-arf-rp04t', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Triggerer', 'system', 'spb99-arf-ap04t', 'airflow-triggerer-v28.service', 'Нет', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Worker', 'system', 'spb99-arf-ap04t', 'airflow-worker-v28.service', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Dag Processor', 'system unit', 'spb99-arf-ap04t', 'airflow-dag-processor-v28.service', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Webserver', 'system unit', 'spb99-arf-ap04t', 'airflow-webserver-v28.service', 'Да', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Webserver', 'http', 'spb99-arf-ap04t', 'https://spb99-arf-ap04t/airflow/v28/login', 'Да', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Redis', 'system unit', 'spb99-arf-ap04t', 'redis-server', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Flower', 'system unit', 'spb99-arf-ap04t', 'airflow-flower-v28.service', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-ap04t', '/home', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-ap04t', '/', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-ap04t', '/usr', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-ap04t', '/var', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-ap04t', '/var/log', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-ap04t', '/var/log/audit', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-ap04t', '/var/tmp', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-ap04t', '/tmp', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'СУБД репозитория', 'system unit', 'spb99-arf-rp04t', 'postgrespro-std-15.service', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-rp04t', '/home', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-rp04t', '/', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-rp04t', '/usr', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-rp04t', '/var', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-rp04t', '/var/log', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-rp04t', '/var/log/audit', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-rp04t', '/var/tmp', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место на диске', 'disk space', 'spb99-arf-rp04t', '/tmp', 'Нет', 'Нет'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место в СУБД', 'disk space', 'spb99-arf-rp04t', '/pgsql/pg_data', 'Да', 'Да'),
('Хранилище данных', 'ETL', 'Airflow - ДП ГПН - Интеграция данных', 'Место в СУБД', 'disk space', 'spb99-arf-rp04t', '/pgsql/pg_backup', 'Да', 'Да');
