import random
import functools
import pandas as pd
import simpy

@functools.lru_cache(maxsize=1)
def load_csv(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    if 'DateTime' in df.columns:
        df['DateTime'] = pd.to_datetime(df['DateTime'], errors='coerce')
    return df

def run_simpy_from_csv(csv_path: str, junction_id: int, capacity: int, sim_hours: int = 5) -> list[dict]:
    """
    CSV'den seçilen kavşak verisini okuyup SimPy ile kuyruklama simülasyonu yapar.
    """
    df = load_csv(csv_path)

    if 'Junction' not in df.columns or 'Vehicles' not in df.columns:
        raise ValueError("CSV dosyasında 'Junction' veya 'Vehicles' sütunu bulunamadı.")

    j_data = (
        df[df['Junction'] == junction_id]
        .sort_values('DateTime' if 'DateTime' in df.columns else df.columns[0])
        .head(sim_hours)
        .reset_index(drop=True)
    )

    if j_data.empty:
        raise ValueError(f"Junction {junction_id} için veri bulunamadı.")

    rng = random.Random(42)
    env = simpy.Environment()
    junction = simpy.Resource(env, capacity=capacity)
    car_records: list[dict] = []

    SERVICE_TIME = 0.05

    def vehicle(env, car_id: str):
        record = {
            'id': car_id,
            'arrive_time': round(env.now, 6),
            'enter_time': None,
            'leave_time': None,
        }
        car_records.append(record)

        with junction.request() as req:
            yield req
            record['enter_time'] = round(env.now, 6)
            yield env.timeout(SERVICE_TIME)
            record['leave_time'] = round(env.now, 6)

    def traffic_generator(env):
        car_counter = 1
        for _, row in j_data.iterrows():
            hour_start = env.now
            num_vehicles = max(0, int(row['Vehicles']))

            if num_vehicles > 0:
                mean_interarrival = 1.0 / num_vehicles
                for _ in range(num_vehicles):
                    interarrival = rng.expovariate(1.0 / mean_interarrival)
                    yield env.timeout(interarrival)
                    env.process(vehicle(env, f"V-{car_counter}"))
                    car_counter += 1

            time_elapsed = env.now - hour_start
            remaining = 1.0 - time_elapsed
            if remaining > 0:
                yield env.timeout(remaining)

    env.process(traffic_generator(env))

    max_queue_drain_time = sim_hours * 50 * SERVICE_TIME
    env.run(until=sim_hours + max_queue_drain_time)

    completed = [
        c for c in car_records
        if c['enter_time'] is not None and c['leave_time'] is not None
    ]
    return completed