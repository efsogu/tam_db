# PRJ-026 Product Truth

- Ürün türü: Operasyonel web uygulaması / karar destek arayüzü.
- Ana kullanıcı: Servis satış yöneticisi ve bakım anlaşması review yapan teknik/operasyon kullanıcıları.
- Başarı: Kullanıcı 5 saniye içinde kritik kapsam, PM, SLA, cihaz ve kaynak kanıtını görür; gerekirse Drive kaynağına gider.
- Source of truth hedefi: merkezi yapılandırılmış veritabanı. Excel yalnız export/audit katmanıdır.
- Kritik semantik: FOUND / AMBIGUOUS / NOT_FOUND / CONFLICT veri katmanında korunur; arayüzde Türkçe karşılık gösterilir.
- Kural: Dokümanda olmayan bilgi üretilmez; NOT_FOUND = Hayır değildir.
- Scope filtresi: case'e özel marka/kapsam talimatları KPI ve Q&A'ya uygulanır.