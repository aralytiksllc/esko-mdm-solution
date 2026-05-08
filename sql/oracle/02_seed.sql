-- =============================================================
-- MDS Seed Data
-- =============================================================

-- Templates
INSERT INTO mds_template VALUES ('purpose_codes','Purpose Codes','🏷️','mds.purpose_codes','brz_mds_purpose_codes','Phase 2','Data Steward → BI Lead',0,NULL,SYSTIMESTAMP);
INSERT INTO mds_template VALUES ('exchange_rates','Exchange Rates','💱','mds.exchange_rates','brz_mds_exchange_rates','MVP','Finance Lead → Data Steward',1,10,SYSTIMESTAMP);
INSERT INTO mds_template VALUES ('business_hierarchies','Business Hierarchies','🏢','mds.business_hierarchies','brz_mds_business_hierarchies','Phase 2','Data Steward',0,NULL,SYSTIMESTAMP);
INSERT INTO mds_template VALUES ('config_tables','Config / Logic Tables','⚙️','mds.config_tables','brz_mds_config_tables','Phase 3','IT Lead → Admin',0,NULL,SYSTIMESTAMP);
INSERT INTO mds_template VALUES ('entity_reference','Entity Reference Data','🏛️','mds.entity_reference','brz_mds_entity_reference','Phase 2','Finance Lead → Legal',0,NULL,SYSTIMESTAMP);

-- Template columns (purpose_codes)
INSERT INTO mds_template_column VALUES ('purpose_codes',1,'Purpose Code','text',1,1,NULL,'Unique purpose code identifier');
INSERT INTO mds_template_column VALUES ('purpose_codes',2,'Description','text',1,0,NULL,'Required');
INSERT INTO mds_template_column VALUES ('purpose_codes',3,'Major Group','text',1,0,NULL,'Required');
INSERT INTO mds_template_column VALUES ('purpose_codes',4,'Minor Group','text',0,0,NULL,NULL);
INSERT INTO mds_template_column VALUES ('purpose_codes',5,'SaaS Flag','select',0,0,'Yes,No','Yes/No');
INSERT INTO mds_template_column VALUES ('purpose_codes',6,'Status','select',0,0,'Active,Inactive','Active/Inactive');

-- Template columns (exchange_rates)
INSERT INTO mds_template_column VALUES ('exchange_rates',1,'Currency Code','text',1,1,NULL,'ISO 4217');
INSERT INTO mds_template_column VALUES ('exchange_rates',2,'Currency Name','text',1,0,NULL,'Required');
INSERT INTO mds_template_column VALUES ('exchange_rates',3,'Jan','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',4,'Feb','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',5,'Mar','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',6,'Apr','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',7,'May','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',8,'Jun','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',9,'Jul','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',10,'Aug','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',11,'Sep','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',12,'Oct','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',13,'Nov','number',0,0,NULL,'> 0');
INSERT INTO mds_template_column VALUES ('exchange_rates',14,'Dec','number',0,0,NULL,'> 0');

-- Template columns (business_hierarchies)
INSERT INTO mds_template_column VALUES ('business_hierarchies',1,'Org Code','text',1,1,NULL,'Unique org code');
INSERT INTO mds_template_column VALUES ('business_hierarchies',2,'Organization Name','text',1,0,NULL,'Required');
INSERT INTO mds_template_column VALUES ('business_hierarchies',3,'Parent Org','text',0,0,NULL,NULL);
INSERT INTO mds_template_column VALUES ('business_hierarchies',4,'Region','text',1,0,NULL,'Required');
INSERT INTO mds_template_column VALUES ('business_hierarchies',5,'Sales Org','text',0,0,NULL,NULL);
INSERT INTO mds_template_column VALUES ('business_hierarchies',6,'Valid From','date',0,0,NULL,'ISO date');
INSERT INTO mds_template_column VALUES ('business_hierarchies',7,'Valid Until','date',0,0,NULL,'ISO date');

-- Template columns (config_tables)
INSERT INTO mds_template_column VALUES ('config_tables',1,'Config Key','text',1,1,NULL,'Unique key');
INSERT INTO mds_template_column VALUES ('config_tables',2,'Config Value','text',0,0,NULL,NULL);
INSERT INTO mds_template_column VALUES ('config_tables',3,'Category','text',1,0,NULL,'Required');
INSERT INTO mds_template_column VALUES ('config_tables',4,'Description','text',0,0,NULL,NULL);
INSERT INTO mds_template_column VALUES ('config_tables',5,'Effective Date','date',0,0,NULL,NULL);
INSERT INTO mds_template_column VALUES ('config_tables',6,'Active','select',0,0,'Yes,No','Yes/No');

-- Template columns (entity_reference)
INSERT INTO mds_template_column VALUES ('entity_reference',1,'Company Code','text',1,1,NULL,'Unique company code');
INSERT INTO mds_template_column VALUES ('entity_reference',2,'Legal Entity Name','text',1,0,NULL,'Required');
INSERT INTO mds_template_column VALUES ('entity_reference',3,'Parent Entity','text',0,0,NULL,NULL);
INSERT INTO mds_template_column VALUES ('entity_reference',4,'Country Code','text',1,0,NULL,'ISO-2');
INSERT INTO mds_template_column VALUES ('entity_reference',5,'Valid From','date',0,0,NULL,NULL);
INSERT INTO mds_template_column VALUES ('entity_reference',6,'Valid Until','date',0,0,NULL,NULL);
INSERT INTO mds_template_column VALUES ('entity_reference',7,'Active','select',0,0,'Yes,No','Yes/No');

-- Users
INSERT INTO mds_user VALUES ('saskia.v','Saskia Verschorre','Admin','saskia@esko.com','SV',1);
INSERT INTO mds_user VALUES ('yannick.b','Yannick Broucke','Editor','yannick@esko.com','YB',1);
INSERT INTO mds_user VALUES ('elena.r','Elena Ruiz','Steward','elena@esko.com','ER',1);
INSERT INTO mds_user VALUES ('viewer','Demo Viewer','Viewer','viewer@esko.com','DV',1);

-- Golden records — purpose_codes
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_pc001','purpose_codes','PC-001','{"Purpose Code":"PC-001","Description":"Software License","Major Group":"Software","Minor Group":"Licenses","SaaS Flag":"Yes","Status":"Active"}',98,'Salesforce','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_pc002','purpose_codes','PC-002','{"Purpose Code":"PC-002","Description":"Hardware Equipment","Major Group":"Hardware","Minor Group":"Equipment","SaaS Flag":"No","Status":"Active"}',100,'Oracle Fusion','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_pc003','purpose_codes','PC-003','{"Purpose Code":"PC-003","Description":"Consulting Services","Major Group":"Services","Minor Group":"Consulting","SaaS Flag":"No","Status":"Active"}',95,'Salesforce','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_pc004','purpose_codes','PC-004','{"Purpose Code":"PC-004","Description":"Cloud Subscription","Major Group":"Software","Minor Group":"Cloud","SaaS Flag":"Yes","Status":"Active"}',92,'Salesforce','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_pc005','purpose_codes','PC-005','{"Purpose Code":"PC-005","Description":"Training & Support","Major Group":"Services","Minor Group":"Training","SaaS Flag":"No","Status":"Active"}',90,'Oracle Fusion','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_pc006','purpose_codes','PC-006','{"Purpose Code":"PC-006","Description":"Maintenance Contract","Major Group":"Services","Minor Group":"Maintenance","SaaS Flag":"No","Status":"Active"}',88,'Oracle Fusion','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_pc007','purpose_codes','PC-007','{"Purpose Code":"PC-007","Description":"Data Analytics Platform","Major Group":"Software","Minor Group":"Analytics","SaaS Flag":"Yes","Status":"Active"}',75,'Salesforce','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_pc008','purpose_codes','PC-008','{"Purpose Code":"PC-008","Description":"Network Infrastructure","Major Group":"Hardware","Minor Group":"Network","SaaS Flag":"No","Status":"Active"}',80,'Oracle Fusion','saskia.v','saskia.v');

-- Golden records — exchange_rates (5 rows)
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_fx_eur','exchange_rates','EUR','{"Currency Code":"EUR","Currency Name":"Euro","Jan":"1.0856","Feb":"1.0790","Mar":"1.0832","Apr":"1.0915","May":"1.0880","Jun":"1.0765","Jul":"1.0920","Aug":"1.0850","Sep":"1.0788","Oct":"1.0910","Nov":"1.0835","Dec":"1.0900"}',100,'ECB','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_fx_gbp','exchange_rates','GBP','{"Currency Code":"GBP","Currency Name":"British Pound","Jan":"1.2650","Feb":"1.2580","Mar":"1.2710","Apr":"1.2690","May":"1.2740","Jun":"1.2620","Jul":"1.2800","Aug":"1.2750","Sep":"1.2680","Oct":"1.2720","Nov":"1.2690","Dec":"1.2770"}',100,'ECB','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_fx_jpy','exchange_rates','JPY','{"Currency Code":"JPY","Currency Name":"Japanese Yen","Jan":"0.00671","Feb":"0.00665","Mar":"0.00678","Apr":"0.00670","May":"0.00682","Jun":"0.00660","Jul":"0.00675","Aug":"0.00668","Sep":"0.00672","Oct":"0.00680","Nov":"0.00666","Dec":"0.00674"}',100,'ECB','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_fx_chf','exchange_rates','CHF','{"Currency Code":"CHF","Currency Name":"Swiss Franc","Jan":"1.1580","Feb":"1.1520","Mar":"1.1610","Apr":"1.1550","May":"1.1590","Jun":"1.1500","Jul":"1.1630","Aug":"1.1560","Sep":"1.1540","Oct":"1.1600","Nov":"1.1570","Dec":"1.1620"}',100,'ECB','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_fx_cad','exchange_rates','CAD','{"Currency Code":"CAD","Currency Name":"Canadian Dollar","Jan":"0.7410","Feb":"0.7380","Mar":"0.7450","Apr":"0.7420","May":"0.7460","Jun":"0.7390","Jul":"0.7480","Aug":"0.7440","Sep":"0.7400","Oct":"0.7430","Nov":"0.7410","Dec":"0.7470"}',100,'ECB','saskia.v','saskia.v');

-- Golden records — business_hierarchies
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_org_glob','business_hierarchies','ORG-GLOB','{"Org Code":"ORG-GLOB","Organization Name":"ESKO Global","Parent Org":"","Region":"Global","Sales Org":"","Valid From":"2024-01-01","Valid Until":"9999-12-31"}',100,'HR','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_org_eu01','business_hierarchies','ORG-EU01','{"Org Code":"ORG-EU01","Organization Name":"ESKO Europe West","Parent Org":"ORG-GLOB","Region":"EMEA","Sales Org":"SO-EU-W","Valid From":"2024-01-01","Valid Until":"9999-12-31"}',100,'HR','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_org_eu02','business_hierarchies','ORG-EU02','{"Org Code":"ORG-EU02","Organization Name":"ESKO Europe East","Parent Org":"ORG-GLOB","Region":"EMEA","Sales Org":"SO-EU-E","Valid From":"2024-01-01","Valid Until":"9999-12-31"}',98,'HR','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_org_na01','business_hierarchies','ORG-NA01','{"Org Code":"ORG-NA01","Organization Name":"ESKO North America","Parent Org":"ORG-GLOB","Region":"Americas","Sales Org":"SO-NA","Valid From":"2024-01-01","Valid Until":"9999-12-31"}',100,'HR','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_org_ap01','business_hierarchies','ORG-AP01','{"Org Code":"ORG-AP01","Organization Name":"ESKO Asia Pacific","Parent Org":"ORG-GLOB","Region":"APAC","Sales Org":"SO-APAC","Valid From":"2024-01-01","Valid Until":"9999-12-31"}',100,'HR','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_org_be01','business_hierarchies','ORG-BE01','{"Org Code":"ORG-BE01","Organization Name":"ESKO Belgium HQ","Parent Org":"ORG-EU01","Region":"EMEA","Sales Org":"SO-EU-W","Valid From":"2024-01-01","Valid Until":"9999-12-31"}',96,'HR','saskia.v','saskia.v');

-- Golden records — config_tables
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_cfg_fcp','config_tables','FCP_CALC_METHOD','{"Config Key":"FCP_CALC_METHOD","Config Value":"STANDARD","Category":"FCP","Description":"Calculation method for FCP reporting","Effective Date":"2024-01-01","Active":"Yes"}',100,'Internal','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_cfg_salesorg','config_tables','SALES_ORG_RULE','{"Config Key":"SALES_ORG_RULE","Config Value":"PURPOSE_CODE","Category":"Sales","Description":"Determines sales org by purpose code","Effective Date":"2024-01-01","Active":"Yes"}',100,'Internal','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_cfg_fx','config_tables','FX_FREEZE_MONTH','{"Config Key":"FX_FREEZE_MONTH","Config Value":"12","Category":"Finance","Description":"Month when FX rates are frozen","Effective Date":"2024-01-01","Active":"Yes"}',100,'Internal','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_cfg_entmap','config_tables','ENTITY_MAP_VER','{"Config Key":"ENTITY_MAP_VER","Config Value":"3.2","Category":"Entity","Description":"Current entity mapping version","Effective Date":"2024-06-01","Active":"Yes"}',100,'Internal','saskia.v','saskia.v');

-- Golden records — entity_reference
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_ent_be01','entity_reference','BE0001','{"Company Code":"BE0001","Legal Entity Name":"ESKO Belgium NV","Parent Entity":"ESKO-Global","Country Code":"BE","Valid From":"2024-01-01","Valid Until":"9999-12-31","Active":"Yes"}',100,'Oracle Fusion','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_ent_nl01','entity_reference','NL0001','{"Company Code":"NL0001","Legal Entity Name":"ESKO Netherlands BV","Parent Entity":"ESKO-Global","Country Code":"NL","Valid From":"2024-01-01","Valid Until":"9999-12-31","Active":"Yes"}',100,'Oracle Fusion','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_ent_us01','entity_reference','US0001','{"Company Code":"US0001","Legal Entity Name":"ESKO North America Inc","Parent Entity":"ESKO-Global","Country Code":"US","Valid From":"2024-01-01","Valid Until":"9999-12-31","Active":"Yes"}',98,'Oracle Fusion','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_ent_de01','entity_reference','DE0001','{"Company Code":"DE0001","Legal Entity Name":"ESKO Germany GmbH","Parent Entity":"ESKO-Global","Country Code":"DE","Valid From":"2024-01-01","Valid Until":"9999-12-31","Active":"Yes"}',100,'Oracle Fusion','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_ent_sg01','entity_reference','SG0001','{"Company Code":"SG0001","Legal Entity Name":"ESKO Singapore Pte Ltd","Parent Entity":"ORG-AP01","Country Code":"SG","Valid From":"2024-01-01","Valid Until":"9999-12-31","Active":"Yes"}',95,'Oracle Fusion','saskia.v','saskia.v');
INSERT INTO mds_golden_record(record_id,template_key,business_key,payload_json,dq_score,source_system,created_by,modified_by) VALUES ('gr_ent_au01','entity_reference','AU0001','{"Company Code":"AU0001","Legal Entity Name":"ESKO Australia Pty Ltd","Parent Entity":"ORG-AP01","Country Code":"AU","Valid From":"2024-01-01","Valid Until":"9999-12-31","Active":"Yes"}',94,'Oracle Fusion','saskia.v','saskia.v');

-- DQ rules
INSERT INTO mds_dq_rule VALUES ('dq_pc_req','purpose_codes','Description','completeness','Description is required','payload->Description IS NOT NULL','error',1);
INSERT INTO mds_dq_rule VALUES ('dq_pc_maj','purpose_codes','Major Group','completeness','Major Group is required','payload->Major Group IS NOT NULL','error',1);
INSERT INTO mds_dq_rule VALUES ('dq_pc_uniq','purpose_codes','Purpose Code','uniqueness','Purpose Code must be unique','COUNT(*)=1','error',1);
INSERT INTO mds_dq_rule VALUES ('dq_fx_num','exchange_rates','*','validity','Monthly rates must be numeric > 0','isNumeric & >0','error',1);
INSERT INTO mds_dq_rule VALUES ('dq_bh_reg','business_hierarchies','Region','completeness','Region is required','payload->Region IS NOT NULL','error',1);
INSERT INTO mds_dq_rule VALUES ('dq_bh_uniq','business_hierarchies','Org Code','uniqueness','Org Code must be unique','COUNT(*)=1','error',1);
INSERT INTO mds_dq_rule VALUES ('dq_er_iso','entity_reference','Country Code','validity','Country Code must be 2-letter ISO','LENGTH=2','warn',1);
INSERT INTO mds_dq_rule VALUES ('dq_time','*','*','timeliness','Record must be updated within 30 days','modified_at > SYSDATE - 30','warn',1);

-- DQ scorecards (precomputed)
INSERT INTO mds_dq_scorecard VALUES ('purpose_codes','completeness',96.5,8,8,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('purpose_codes','uniqueness',100,8,8,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('purpose_codes','validity',92,8,7,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('purpose_codes','timeliness',88,8,7,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('exchange_rates','completeness',100,5,5,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('exchange_rates','uniqueness',100,5,5,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('exchange_rates','validity',100,5,5,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('exchange_rates','timeliness',95,5,5,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('business_hierarchies','completeness',97,6,6,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('business_hierarchies','uniqueness',100,6,6,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('business_hierarchies','validity',95,6,5,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('business_hierarchies','timeliness',90,6,5,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('config_tables','completeness',100,4,4,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('config_tables','uniqueness',100,4,4,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('config_tables','validity',100,4,4,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('config_tables','timeliness',85,4,3,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('entity_reference','completeness',98,6,6,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('entity_reference','uniqueness',100,6,6,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('entity_reference','validity',94,6,5,SYSTIMESTAMP);
INSERT INTO mds_dq_scorecard VALUES ('entity_reference','timeliness',92,6,5,SYSTIMESTAMP);

-- Match candidates (duplicates to resolve)
INSERT INTO mds_match_group VALUES ('mg_001','purpose_codes','pending',88,NULL,'Fuzzy name 85%',SYSTIMESTAMP,NULL,NULL);
INSERT INTO mds_match_candidate VALUES ('mg_001','gr_pc007','Salesforce',100,1);
INSERT INTO mds_match_candidate VALUES ('mg_001','gr_pc008','Oracle Fusion',85,0);
INSERT INTO mds_match_group VALUES ('mg_002','entity_reference','pending',92,NULL,'Same name, different codes',SYSTIMESTAMP,NULL,NULL);
INSERT INTO mds_match_candidate VALUES ('mg_002','gr_ent_sg01','Oracle Fusion',100,1);
INSERT INTO mds_match_candidate VALUES ('mg_002','gr_ent_au01','Salesforce',72,0);

-- Survivorship rules
INSERT INTO mds_survivorship_rule VALUES ('sr_pc_desc','purpose_codes','Description','source_priority','Salesforce,Oracle Fusion,SAP',1);
INSERT INTO mds_survivorship_rule VALUES ('sr_pc_stat','purpose_codes','Status','most_recent',NULL,1);
INSERT INTO mds_survivorship_rule VALUES ('sr_er_legal','entity_reference','Legal Entity Name','longest',NULL,1);
INSERT INTO mds_survivorship_rule VALUES ('sr_er_cc','entity_reference','Country Code','highest_trust',NULL,1);
INSERT INTO mds_survivorship_rule VALUES ('sr_bh_reg','business_hierarchies','Region','source_priority','HR,Finance',1);

-- Hierarchies
INSERT INTO mds_hierarchy VALUES ('hier_org','ESKO Organization','business_hierarchies','Top-down org structure',SYSTIMESTAMP);
INSERT INTO mds_hierarchy_node VALUES ('n_glob','hier_org',NULL,'gr_org_glob','ESKO Global',0,0);
INSERT INTO mds_hierarchy_node VALUES ('n_eu01','hier_org','n_glob','gr_org_eu01','ESKO Europe West',1,0);
INSERT INTO mds_hierarchy_node VALUES ('n_eu02','hier_org','n_glob','gr_org_eu02','ESKO Europe East',1,1);
INSERT INTO mds_hierarchy_node VALUES ('n_na01','hier_org','n_glob','gr_org_na01','ESKO North America',1,2);
INSERT INTO mds_hierarchy_node VALUES ('n_ap01','hier_org','n_glob','gr_org_ap01','ESKO Asia Pacific',1,3);
INSERT INTO mds_hierarchy_node VALUES ('n_be01','hier_org','n_eu01','gr_org_be01','ESKO Belgium HQ',2,0);

-- XREF
INSERT INTO mds_xref VALUES ('xr_01','gr_pc001','Salesforce','SF_PC_001','Software License',SYSTIMESTAMP,1);
INSERT INTO mds_xref VALUES ('xr_02','gr_pc001','Oracle Fusion','OR_PC_001','Software License',SYSTIMESTAMP,1);
INSERT INTO mds_xref VALUES ('xr_03','gr_pc002','Salesforce','SF_PC_002','Hardware Equipment',SYSTIMESTAMP,1);
INSERT INTO mds_xref VALUES ('xr_04','gr_pc002','Oracle Fusion','OR_PC_002','Hardware Equipment',SYSTIMESTAMP,1);
INSERT INTO mds_xref VALUES ('xr_05','gr_pc007','Salesforce','SF_PC_007','Data Analytics',SYSTIMESTAMP,1);
INSERT INTO mds_xref VALUES ('xr_06','gr_pc008','Oracle Fusion','OR_PC_008','Network Infra',SYSTIMESTAMP,1);
INSERT INTO mds_xref VALUES ('xr_07','gr_ent_be01','SAP','10010','ESKO Belgium NV',SYSTIMESTAMP,1);
INSERT INTO mds_xref VALUES ('xr_08','gr_ent_nl01','SAP','10020','ESKO Netherlands BV',SYSTIMESTAMP,1);
INSERT INTO mds_xref VALUES ('xr_09','gr_ent_us01','Oracle Fusion','3001','ESKO North America Inc',SYSTIMESTAMP,1);

-- Glossary
INSERT INTO mds_glossary_term VALUES ('gt_01','Purpose Code','Classification code used to categorize transactions by business purpose','Finance','Finance Lead','Saskia Verschorre','approved','purpose_codes','Purpose Code',SYSTIMESTAMP,SYSTIMESTAMP);
INSERT INTO mds_glossary_term VALUES ('gt_02','SaaS Flag','Indicates whether a purpose code is associated with software-as-a-service revenue','Finance','Finance Lead','Saskia Verschorre','approved','purpose_codes','SaaS Flag',SYSTIMESTAMP,SYSTIMESTAMP);
INSERT INTO mds_glossary_term VALUES ('gt_03','Legal Entity','A recognized business entity with its own legal identity for regulatory and tax purposes','Entity','Legal','Yannick Broucke','approved','entity_reference','Legal Entity Name',SYSTIMESTAMP,SYSTIMESTAMP);
INSERT INTO mds_glossary_term VALUES ('gt_04','Golden Record','The authoritative single version of truth for a business entity, consolidated from multiple sources','MDM','Data Steward','Elena Ruiz','approved',NULL,NULL,SYSTIMESTAMP,SYSTIMESTAMP);
INSERT INTO mds_glossary_term VALUES ('gt_05','Exchange Rate','Monthly currency conversion rate used for financial consolidation','Finance','Finance Lead','Saskia Verschorre','approved','exchange_rates','Currency Code',SYSTIMESTAMP,SYSTIMESTAMP);
INSERT INTO mds_glossary_term VALUES ('gt_06','Organization','An internal business unit in the ESKO org structure','Org','HR','Yannick Broucke','approved','business_hierarchies','Org Code',SYSTIMESTAMP,SYSTIMESTAMP);
INSERT INTO mds_glossary_term VALUES ('gt_07','FCP','Free Cash Position — a finance reporting calculation','Finance','Finance Lead','Saskia Verschorre','approved',NULL,NULL,SYSTIMESTAMP,SYSTIMESTAMP);
INSERT INTO mds_glossary_term VALUES ('gt_08','Source Priority','Survivorship rule that picks the winning value based on source system trust rank','MDM','Data Steward','Elena Ruiz','approved',NULL,NULL,SYSTIMESTAMP,SYSTIMESTAMP);
INSERT INTO mds_glossary_term VALUES ('gt_09','SCD2','Slowly Changing Dimension type 2 — preserves historical versions with valid_from/valid_to','MDM','Data Steward','Elena Ruiz','approved',NULL,NULL,SYSTIMESTAMP,SYSTIMESTAMP);

-- Entity relationships
INSERT INTO mds_entity_relationship VALUES ('er_01','entity_reference','business_hierarchies','Parent Entity','Org Code','N:1','Entity belongs to org');
INSERT INTO mds_entity_relationship VALUES ('er_02','business_hierarchies','business_hierarchies','Parent Org','Org Code','N:1','Org parent');
INSERT INTO mds_entity_relationship VALUES ('er_03','purpose_codes','config_tables','Major Group','Config Value','N:1','Purpose category');

-- Stewardship tasks
INSERT INTO mds_stewardship_task VALUES ('st_01','merge_candidate','purpose_codes','gr_pc007','high','Possible duplicate: PC-007 vs PC-008','Fuzzy match score 88 — review and merge or dismiss','elena.r','open',SYSTIMESTAMP,NULL,NULL,'mg_001');
INSERT INTO mds_stewardship_task VALUES ('st_02','merge_candidate','entity_reference','gr_ent_sg01','med','Possible duplicate: SG0001 vs AU0001','Fuzzy match score 72 — review','elena.r','open',SYSTIMESTAMP,NULL,NULL,'mg_002');
INSERT INTO mds_stewardship_task VALUES ('st_03','dq_fail','purpose_codes','gr_pc007','med','DQ validity failed on PC-007','Description shorter than 20 chars — enrichment needed','elena.r','open',SYSTIMESTAMP,NULL,NULL,NULL);
INSERT INTO mds_stewardship_task VALUES ('st_04','drift','purpose_codes','gr_pc008','high','Drift detected: SQL vs Salesforce','PC-008 value differs across systems — reconcile','saskia.v','open',SYSTIMESTAMP,NULL,NULL,NULL);
INSERT INTO mds_stewardship_task VALUES ('st_05','enrichment','entity_reference','gr_ent_au01','low','Missing tax ID for AU0001','Enrich with external registry lookup','elena.r','in_progress',SYSTIMESTAMP,NULL,NULL,NULL);

-- Reconciliation samples
INSERT INTO mds_reconciliation VALUES ('rc_01','purpose_codes','PC-001','Software License','Software License','Software License','Software License','match',SYSTIMESTAMP);
INSERT INTO mds_reconciliation VALUES ('rc_02','purpose_codes','PC-002','Hardware Equipment','Hardware Equipment','Hardware Equipment','Hardware Equipment','match',SYSTIMESTAMP);
INSERT INTO mds_reconciliation VALUES ('rc_03','purpose_codes','PC-003','Consulting Services','Consulting Services','Consulting Services','Consulting Services','match',SYSTIMESTAMP);
INSERT INTO mds_reconciliation VALUES ('rc_04','purpose_codes','PC-004','Cloud Subscription','Cloud Subscription','Cloud Subscription','Cloud Subscription','match',SYSTIMESTAMP);
INSERT INTO mds_reconciliation VALUES ('rc_05','purpose_codes','PC-007','Data Analytics Platform','Data Analytics Platform','Data Analytics',NULL,'drift',SYSTIMESTAMP);
INSERT INTO mds_reconciliation VALUES ('rc_06','purpose_codes','PC-008','Network Infrastructure','Network Infrastructure',NULL,'Network Infra','drift',SYSTIMESTAMP);

-- Workflow samples
INSERT INTO mds_workflow_request VALUES ('wr_01','purpose_codes','yannick.b',SYSTIMESTAMP,3,2,'steward_review','pending','{"changes":"PC-009,PC-010,PC-011"}','mds.purpose_codes',NULL);
INSERT INTO mds_workflow_step VALUES ('ws_01','wr_01','draft',1,'yannick.b','submitted','Initial submission',SYSTIMESTAMP);

-- Audit samples
INSERT INTO mds_audit_log VALUES ('al_01','gr_pc001','purpose_codes','PC-001','create',NULL,NULL,'(new record)','saskia.v','Admin','b_001','Initial seed',SYSTIMESTAMP);
INSERT INTO mds_audit_log VALUES ('al_02','gr_pc007','purpose_codes','PC-007','update','Description','Data Analytics','Data Analytics Platform','saskia.v','Admin','b_002','Expanded name',SYSTIMESTAMP);
INSERT INTO mds_audit_log VALUES ('al_03','gr_pc008','purpose_codes','PC-008','update','Minor Group','Networking','Network','saskia.v','Admin','b_003','Standardized',SYSTIMESTAMP);

-- History samples (6 months rolling)
INSERT INTO mds_record_history(history_id,record_id,template_key,business_key,payload_json,valid_from,valid_to,change_type,changed_by) VALUES ('h_01','gr_pc007','purpose_codes','PC-007','{"Description":"Data Analytics"}',SYSTIMESTAMP - NUMTODSINTERVAL(180,'DAY'), SYSTIMESTAMP - NUMTODSINTERVAL(60,'DAY'),'update','saskia.v');
INSERT INTO mds_record_history(history_id,record_id,template_key,business_key,payload_json,valid_from,valid_to,change_type,changed_by) VALUES ('h_02','gr_pc007','purpose_codes','PC-007','{"Description":"Data Analytics Platform"}',SYSTIMESTAMP - NUMTODSINTERVAL(60,'DAY'), SYSTIMESTAMP,'update','saskia.v');
INSERT INTO mds_record_history(history_id,record_id,template_key,business_key,payload_json,valid_from,valid_to,change_type,changed_by) VALUES ('h_03','gr_pc008','purpose_codes','PC-008','{"Minor Group":"Networking"}',SYSTIMESTAMP - NUMTODSINTERVAL(150,'DAY'), SYSTIMESTAMP - NUMTODSINTERVAL(30,'DAY'),'update','saskia.v');

COMMIT;
