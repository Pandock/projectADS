Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: Received exception from server (version 24.3.2):
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: Code: 999. DB::Exception: Received from localhost:9440. Coordination::Exception. Coordination::Exception: Coordination error: Connection loss, path /clickhouse/task_queue/ddl/query-. Stack trace:
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 0. Poco::Exception::Exception(String const&, int) @ 0x0000000013e21699
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 1. DB::Exception::Exception(DB::Exception::MessageMasked&&, int, bool) @ 0x000000000b0fcad7
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 2. DB::Exception::Exception<char const*, String const&>(int, FormatStringHelperImpl<std::type_identity<char const*>::type, std::type_identity<String const&>::type>, char const*&&, String const&) @ 0x000000000e92a56a
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 3. Coordination::Exception::fromPath(Coordination::Error, String const&) @ 0x000000000e929ecb
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 4. zkutil::ZooKeeper::createAncestors(String const&) @ 0x00000000117a3c81
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 5. DB::DDLWorker::enqueueQuery(DB::DDLLogEntry&) @ 0x000000000f56927c
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 6. DB::executeDDLQueryOnCluster(std::shared_ptr<DB::IAST> const&, std::shared_ptr<DB::Context const>, DB::DDLQueryOnClusterParams const&) @ 0x0000000010162e09
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 7. DB::InterpreterGrantQuery::execute() @ 0x00000000102529f1
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 8. DB::executeQueryImpl(char const*, char const*, std::shared_ptr<DB::Context>, DB::QueryFlags, DB::QueryProcessingStage::Enum, DB::ReadBuffer*) @ 0x000000001017ab08
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 9. DB::executeQuery(String const&, std::shared_ptr<DB::Context>, DB::QueryFlags, DB::QueryProcessingStage::Enum) @ 0x0000000010176fda
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 10. DB::TCPHandler::runImpl() @ 0x000000001112fcb6
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 11. DB::TCPHandler::run() @ 0x0000000011147279
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 12. Poco::Net::TCPServerConnection::start() @ 0x0000000013d3cb27
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 13. Poco::Net::TCPServerDispatcher::run() @ 0x0000000013d3d01e
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 14. Poco::PooledThread::run() @ 0x0000000013e77f47
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 15. Poco::ThreadImpl::runnableEntry(void*) @ 0x0000000013e75a63
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 16. start_thread @ 0x0000000000007ed3
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: 17. ? @ 0x00000000000f998f
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: . (KEEPER_EXCEPTION)
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: (query: --grant on cluster gpn ALTER VIEW REFRESH on `brd_nng_dmt_dmn_frbcs_nonsens`.* to `ldap_SPB-GP-DMP-DWH-A-BRD-ADQM-DB-ADM`;
Nov 28 12:03:19 spb99akl-dadqm1 access_sync.sh[2033777]: grant on cluster gpn CREATE VIEW on `brd_nng_dmt_dmn_frbcs_nonsens`.* to `ldap_SPB-GP-DMP-DWH-A-BRD-ADQM-DB-ADM`;)
Nov 28 12:03:19 spb99akl-dadqm1 systemd[1]: adch_sync.service: Main process exited, code=exited, status=231/APPARMOR
