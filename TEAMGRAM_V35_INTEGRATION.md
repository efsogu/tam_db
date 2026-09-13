# Teklif Analiz Merkezi v35 → TeamGram Proposal Sync

Bu branch, kullanıcının paylaştığı `stock_latest_snapshot_v35_package` içindeki doğrulanmış v35 client build'ini `tam_db` test ortamının yeni frontend baseline'ı yapar.

## Korunan v35 özellikleri
- Stok 360 / `Stoku Güncelle`
- Operasyonel Görünüm / Tüm TeamGram Alanları / API Metadata
- teklif satırı ↔ stok SKU entegrasyonu
- Çok Kalemli Teklif Simülatörü
- mevcut Excel + maliyet Excel importu, filtreler, grafikler, exportlar

## Yeni teklif API akışı
Browser yalnız same-origin `/api/teamgram-proposals-sync` endpoint'ini çağırır. TeamGram token yalnız Vercel environment secret'tan server-side okunur.

1. `Proposals/Index` tüm sayfalar okunur ve Index fingerprint'leri alınır.
2. IndexedDB son başarılı bundle cache'i ile karşılaştırılır.
3. Yalnız yeni/değişen teklifler `Proposals/Get` + `Proposals/StatusLog` ile zenginleştirilir.
4. Başarılı detaylar `staging` store'a yazılır; yarıda kalan ilk sync kaldığı veriyi tekrar kullanabilir.
5. Tüm snapshot tamamlanmadan `bundles` (son iyi snapshot) overwrite edilmez.
6. Normalize edilmiş satırlar memory'de v35'in beklediği `Teklifler / Detaylar / Durum tarihçesi` workbook'una çevrilir ve mevcut `analyzeWorkbookFromFile()` motoruna verilir.
7. `ParentProposalId` offer modeline taşınır. KPI hesap kümesi transitive ParentProposal zincirinde yalnız en güncel revizyonu kullanır; `Revize edildi` filtresi korunur.

## Rate limit
TeamGram resmi limitleri 3 istek/sn veya 60 istek/dk ve HTTP 429 + `Retry-After` şeklindedir. Index sayfaları ve proposal detail çağrıları buna göre aralıklı yapılır. İlk tam sync teklif sayısına göre uzun sürebilir; sonraki sync'lerde fingerprint cache çağrı sayısını ciddi azaltır.

## Güvenlik
- Token client HTML/JS içine gömülmez.
- Browser doğrudan `api.teamgram.com` çağırmaz.
- API responses token içermez.
- Stok endpoint'i de aynı server secret'ı kullanır.
