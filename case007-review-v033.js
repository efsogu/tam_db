(()=>{
  const data=window.__PRJ026_DATA__;
  const c=data?.cases?.find(x=>x.id==='CASE_007');
  if(!c)return;
  const reviewedAt='2026-10-14T00:17:33+03:00';
  const decisions={
    'Yedek Parça Dahiliyeti':'APPROVE',
    'PM Kit Dahiliyeti':'APPROVE',
    'Yazılım':'APPROVE',
    'Kullanıcı Eğitimi':'APPROVE',
    'Teknik Eğitim':'CONFIRM_AMBIGUITY',
    'Yıllık PM adedi':'APPROVE',
    'PM periyodu':'APPROVE',
    'İlk PM son tarihi':'APPROVE',
    'PM kaçırma cezası':'APPROVE',
    'Yerinde müdahale süresi':'CONFIRM_AMBIGUITY',
    'Parçasız onarım süresi':'APPROVE',
    'Uptime hedefi':'APPROVE',
    'Ölçüm periyodu':'APPROVE',
    'Uptime cezası':'APPROVE',
    'Değişen parçanın garanti süresi':'CONFIRM_AMBIGUITY',
    'Üretici yetki belgesi':'CONFIRM_AMBIGUITY',
    'Hizmet yeterlilik belgesi':'APPROVE',
    'Referans sözleşme şartı':'APPROVE',
    'Ödeme vadesi':'APPROVE',
    'Genel cezai şart oranı / tutarı':'APPROVE',
    'Cezanın uygulanma koşulu ve hesaplama esası':'APPROVE',
    'Maksimum genel ceza sınırı':'APPROVE'
  };
  let fieldCount=0;
  for(const f of c.fields||[]){
    const action=decisions[f.field_label];
    if(!action)continue;
    f.review_status='APPROVED';
    f.review_decision=action;
    f.reviewed_by='Erdem';
    f.reviewed_at=reviewedAt;
    fieldCount++;
  }
  let queueCount=0;
  for(const q of c.review_queue||[]){
    const action=decisions[q.field_label];
    if(!action)continue;
    q.queue_status='RESOLVED';
    q.decision=action;
    q.reviewed_by='Erdem';
    q.reviewed_at=reviewedAt;
    queueCount++;
  }
  c.manual_review_summary={
    ...(c.manual_review_summary||{}),
    review_count:Math.max(0,(c.review_queue||[]).filter(x=>x.queue_status==='PENDING').length),
    resolved_count:queueCount,
    review_batch:'CASE_007-HR-20261014-01',
    review_completed_at:reviewedAt,
    note:'22/22 human review decisions committed: 17 FOUND APPROVE + 4 AMBIGUOUS CONFIRM_AMBIGUITY + 1 CONFLICT APPROVE (conflict semantics preserved). Full-75 remains NOT_COMPLETE; 29/75 unknown.'
  };
  c.human_review={status:(fieldCount===22&&queueCount===22)?'COMPLETED':'INCOMPLETE',resolved:queueCount,total:22,batch_id:'CASE_007-HR-20261014-01',reviewed_at:reviewedAt};
})();
