import os
import webbrowser
from threading import Timer
from flask import Flask, jsonify, request, render_template

from simulation import run_simpy_from_csv

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/simulate', methods=['GET'])
def simulate():
    try:
        junction_id = int(request.args.get('junction', 1))
        capacity    = int(request.args.get('capacity', 2))
        sim_hours   = int(request.args.get('hours', 5))

        if not (1 <= capacity <= 10):
            return jsonify({'error': 'Kapasite 1–10 arasında olmalıdır.'}), 400
        if not (1 <= sim_hours <= 24):
            return jsonify({'error': 'Simülasyon süresi 1–24 saat arasında olmalıdır.'}), 400

    except (ValueError, TypeError):
        return jsonify({'error': 'Geçersiz parametre. junction ve capacity tam sayı olmalıdır.'}), 400

    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path   = os.path.join(script_dir, 'traffic.csv')

    if not os.path.exists(csv_path):
        return jsonify({
            'error': f"'traffic.csv' dosyası bulunamadı! Şu dizinde arandı: {script_dir}"
        }), 404

    try:
        records = run_simpy_from_csv(csv_path, junction_id, capacity, sim_hours)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Simülasyon hatası: {str(e)}'}), 500

    if not records:
        return jsonify({'error': 'Simülasyon tamamlandı ancak hiç araç işlenemedi. Veriyi kontrol edin.'}), 200

    return jsonify(records)


def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    print("=" * 55)
    print("  SimPy Trafik Simülasyonu Docker Üzerinde Başlatılıyor...")
    print("  Adres: http://localhost:5000/")
    print("=" * 55)
    app.run(host='0.0.0.0', port=5000, debug=False)