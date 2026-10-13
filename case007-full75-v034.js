(()=>{
  const data=window.__PRJ026_DATA__;
  const c=data?.cases?.find(x=>x.id==='CASE_007');
  if(!c)return;
  const auditedAt='2026-10-14T00:48:40+03:00';
  const docUrl='https://drive.google.com/file/d/1gN2pU6nGz0HqEfhdS2ILoVv3rAkP7LyE/view';
  const upgrades={
    'scope.accessory_inclusion':{
      raw_value:'MKYS ekinde AKSESUAR nitelikli kalemler var; Md.7 yalnız SARF ve YEDEK PARÇA maliyet sorumluluğunu tanımlar',
      normalized_value:'AKSESUAR sınıfı mevcut; maliyet/dahiliyet sorumluluğu açık tanımlanmamış',
      extraction_status:'AMBIGUOUS',source_document_id:'DOC-SINCAN-DATEX-TEKNIK-001',source_document_type:'Teknik Şartname',source_document_version:'v1',source_page:'6-7',source_clause:'Md.7 + MKYS Ek',
      source_text_short:'Md.7: SARF idare, YEDEK PARÇA yüklenici tarafından karşılanır. MKYS ekinde ayrıca AKSESUAR nitelikli kalem bulunur; aksesuar maliyet sorumluluğu açık tanımlanmamıştır.',
      confidence:'MEDIUM',risk_flag:'ACCESSORY_COST_SCOPE_UNDEFINED',provenance_quality:'SOURCE_LINKED',evidence_basis:'RELATED_EVIDENCE_NOT_EXPLICIT',source_url:docUrl,
      notes:'Full-75 v0.34 ikinci tarama: AKSESUAR sınıfı bulundu; dahil/hariç maliyet tarafı açık olmadığı için AMBIGUOUS.'
    },
    'sla.service_24x7_required':{
      raw_value:'Sürekli ve kesintisiz çalışmayı sağlama yükümlülüğü var; 7/24 servis/çağrı organizasyonu açık değil',
      normalized_value:'Kesintisiz çalışma yükümlülüğü var; açık 7/24 servis organizasyonu yok',
      extraction_status:'AMBIGUOUS',source_document_id:'DOC-SINCAN-DATEX-TEKNIK-001',source_document_type:'Teknik Şartname',source_document_version:'v1',source_page:3,source_clause:'Md.2.2.14',
      source_text_short:'Yüklenici cihazların sürekli ve kesintisiz çalışmasını sağlamakla yükümlüdür; ancak 7/24 çağrı merkezi, servis erişimi veya nöbet organizasyonu açıkça düzenlenmemiştir.',
      confidence:'MEDIUM',risk_flag:'CONTINUOUS_OPERATION_NOT_EXPLICIT_24X7_SERVICE',provenance_quality:'SOURCE_LINKED',evidence_basis:'RELATED_EVIDENCE_NOT_EXPLICIT',source_url:docUrl,
      notes:'Full-75 v0.34 ikinci tarama: kesintisiz çalışma yükümlülüğü, açık 7/24 servis SLA olarak yorumlanmadı.'
    },
    'parts.mandatory_stock_items':{
      raw_value:'Gerekli yedek parçaların temini ve hazır bulundurulması zorunlu; tekil zorunlu stok kalemleri tanımlanmamış',
      normalized_value:'Hazır bulundurma yükümlülüğü var; zorunlu stok kalem listesi/miktarı yok',
      extraction_status:'AMBIGUOUS',source_document_id:'DOC-SINCAN-DATEX-TEKNIK-001',source_document_type:'Teknik Şartname',source_document_version:'v1',source_page:'2, 6-12',source_clause:'Md.2.2.2 + Md.7/MKYS Ek',
      source_text_short:'Md.2.2.2 gerekli yedek parçaların temini ve hazır bulundurulmasını yükleniciye yükler; MKYS eki parça/sarf/aksesuar kalemleri içerir ancak hangi kalemlerin zorunlu stok tutulacağı ayrıca belirtilmez.',
      confidence:'MEDIUM',risk_flag:'STOCK_ITEM_LIST_NOT_EXPLICIT',provenance_quality:'SOURCE_LINKED',evidence_basis:'RELATED_EVIDENCE_NOT_EXPLICIT',source_url:docUrl,
      notes:'Full-75 v0.34 ikinci tarama: stok hazır bulundurma yükümlülüğü var, fakat spesifik zorunlu stok listesi yok.'
    }
  };
  for(const f of c.fields||[]){
    const u=upgrades[f.field_key];
    if(u) Object.assign(f,u,{review_status:'PENDING',reviewed_by:null,reviewed_at:null,full75_audit_disposition:'RELATED_EVIDENCE_NOT_EXPLICIT',full75_audited_at:auditedAt});
  }
  const pendingSpecs=[
    ['23','scope.accessory_inclusion','Aksesuar','Full-75 ikinci taramada aksesuar sınıfı bulundu ancak maliyet/dahiliyet kuralı yalnız SARF ve YEDEK PARÇA için yazılmış.'],
    ['24','sla.service_24x7_required','7/24 hizmet zorunluluğu','Sürekli/kesintisiz çalışma yükümlülüğü ile açık 7/24 servis organizasyonu aynı şey değildir; insan semantik kararı gerekli.'],
    ['25','parts.mandatory_stock_items','Zorunlu stokta tutulacak parçalar','Hazır bulundurma yükümlülüğü var fakat tekil stok kalemleri veya miktarları açıkça tanımlanmamış.']
  ];
  for(const [n,key,label,reason] of pendingSpecs){
    if((c.review_queue||[]).some(q=>q.field_key===key)) continue;
    const f=(c.fields||[]).find(x=>x.field_key===key);
    c.review_queue.push({
      review_item_id:`BA-2026-ANKARA-SINCAN-0007-REV-${n}`,
      case_id:'CASE_007',target_type:'FIELD',target_id:key,field_key:key,field_label:label,
      extraction_status:f.extraction_status,normalized_value:f.normalized_value,unit:f.unit,confidence:f.confidence,risk_flag:f.risk_flag,
      reason,source_document_id:f.source_document_id,source_page:f.source_page,source_clause:f.source_clause,source_text_short:f.source_text_short,
      queue_status:'PENDING',decision:null,reviewed_by:null,reviewed_at:null
    });
  }
  const trueNotFoundKeys=[
    'case.offer_number','case.agreement_number','pm.kit_cost_per_device','pm.post_service_label_required','sla.remote_support_time','sla.in_city_response_time','sla.out_of_city_response_time','sla.repair_time_local_stock_part','sla.repair_time_overseas_stock_part','sla.repair_time_after_part_supply','continuity.loaner_device_required','continuity.loaner_device_delivery_time','uptime.planned_maintenance_excluded','uptime.user_caused_downtime_excluded','uptime.part_wait_time_included','uptime.institution_unavailable_time_rule','uptime.force_majeure_rule','uptime.penalty_cap','parts.committed_special_price','parts.stock_quantity','parts.imported_part_exception','qualification.distributor_channel_partner_certificate','qualification.minimum_personnel_count','qualification.regional_service_office_requirement','qualification.iso_certificates','qualification.privacy_kvkk_cybersecurity_conditions'
  ];
  for(const key of trueNotFoundKeys){
    const f=(c.fields||[]).find(x=>x.field_key===key);
    if(f && f.extraction_status==='NOT_FOUND') Object.assign(f,{full75_audit_disposition:'TRUE_NOT_FOUND',full75_audited_at:auditedAt});
  }
  const counts=(c.fields||[]).reduce((a,f)=>(a[f.extraction_status]=(a[f.extraction_status]||0)+1,a),{});
  const pending=(c.review_queue||[]).filter(x=>x.queue_status==='PENDING').length;
  const resolved=(c.review_queue||[]).filter(x=>x.queue_status==='RESOLVED').length;
  c.active_version='v0.34';
  c.analysis_status='NEEDS_REVIEW';
  c.manual_review_summary={
    ...(c.manual_review_summary||{}),status_counts:counts,review_count:pending,resolved_count:resolved,
    note:'Full-75 v0.34 evidence audit: 29/29 prior unknown fields re-audited; 26 TRUE_NOT_FOUND + 3 RELATED_EVIDENCE_NOT_EXPLICIT→AMBIGUOUS. Original 22/22 review remains resolved; 3 new semantic reviews are PENDING.',
    followup_review_batch:'CASE_007-HR-20261014-02',followup_review_created_at:auditedAt
  };
  c.human_review={status:'PENDING',resolved,total:(c.review_queue||[]).length,batch_id:'CASE_007-HR-20261014-02',previous_batch_id:'CASE_007-HR-20261014-01',reviewed_at:null};
  c.full75_audit={
    version:'v0.34',audited_at:auditedAt,audited_previous_unknown:29,true_not_found:26,ambiguous_candidates:3,unverified:0,
    evidence_coverage_gate:'PASS',canonical_publish_gate:'NEEDS_REVIEW',production_promotion:'NOT_APPLIED',
    source_workbook:'CASE_007_Sincan_candidate_gold_v0.1.xlsx',source_workbook_drive_id:'1ba_h3BUsDy4_6tgZ5GOTuZFO8enlECOf'
  };
  c.acceptance={
    ...(c.acceptance||{}),observed_field_count:49,source_derived_count:49,true_not_found_count:26,coverage_unknown_count:0,
    required_observed_count:22,required_unknown_count:0,coverage_ratio:0.653333,required_coverage_ratio:0.709677,observed_value_coverage_ratio:0.653333,required_observed_value_coverage_ratio:0.709677,
    evidence_coverage_ratio:1,required_evidence_coverage_ratio:1,provenance_complete_observed_count:49,
    evidence_gate:{pass:true,issues:[],checked_fields:75},stage_a_precision_gate:'PASS',full_75_evidence_coverage:'PASS',
    full_75_field_acceptance:'NOT_COMPLETE_REVIEW_PENDING',coverage_basis:'SOURCE_DERIVED_PLUS_NEGATIVE_AUDIT_V0_34',human_publish_review:'PENDING_3'
  };
})();
