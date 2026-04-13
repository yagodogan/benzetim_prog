
# 🚦 SimPy & Flask Trafik Simülasyonu

  

Bu proje, bir veya birden fazla kavşaktaki trafik akışını kuyruk teorisi kullanarak simüle eden ve sonuçları web tarayıcısı üzerinde görselleştiren interaktif bir uygulamadır.

  

Arka planda simülasyon motoru olarak **SimPy** ve veri işleme için **Pandas** kullanılırken, ön yüzde kullanıcıya **HTML5 Canvas** ile akıcı bir animasyon sunulmaktadır. Proje, kolay dağıtım ve çalıştırma için dockerize edilmistir.


## Özellikler

-  **Veri Odaklı Simülasyon:** Araç geliş sıklıkları ve sayıları `traffic.csv` dosyasından dinamik olarak okunur.

-  **Kuyruk Teorisi (Queueing):** SimPy kullanılarak araçların kavşak kapasitesine göre bekleme, kuyruğa girme ve geçiş yapma durumları hesaplanır.

-  **Canlı Görselleştirme:** Hesaplanan simülasyon verisi (araç geliş, bekleme ve ayrılış süreleri) web arayüzünde HTML5 Canvas ile anime edilir.

-  **İnteraktif Kontroller:** Kullanıcı arayüzü üzerinden kavşak seçimi, kavşak kapasitesi (aynı anda işlem gören araç sayısı) ve animasyon oynatma hızı (1x - 8x) ayarlanabilir.

-  **Gerçek Zamanlı İstatistikler:** Simüle edilen saat, anlık kuyruk uzunluğu, geçen toplam araç sayısı ve ortalama bekleme süresi ekranda anlık olarak gösterilir.

-  **Docker Desteği:** Sistem bağımlılıklarıyla uğraşmadan tek komutla çalıştırılabilir.

## Kurulum ve Çalıştırma

1-Projeyi github'tan cekme

    git clone git@github.com:yagodogan/benzetim_prog.git

2-Proje klasorune girme

    cd benzetim_prog  
3-Docker containerini ayaga kaldirma

    docker-compose up --build

4-Kurulum tamamlandıktan sonra tarayıcınızdan şu adrese gidin:

    http://localhost:5000

  


  

