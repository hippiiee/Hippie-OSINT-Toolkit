import re
import requests
import asyncio
import logging
from datetime import datetime, timezone
from core.base_module import OsintModule

BTC_LEGACY_RE = re.compile(r"^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$")
BTC_BECH32_RE = re.compile(r"^bc1[a-zA-HJ-NP-Z0-9]{25,62}$")
ETH_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")

BLOCKCYPHER_BTC = "https://api.blockcypher.com/v1/btc/main"
BLOCKCYPHER_ETH = "https://api.blockcypher.com/v1/eth/main"


def detect_address_type(address: str) -> str | None:
    if BTC_LEGACY_RE.match(address) or BTC_BECH32_RE.match(address):
        return "btc"
    if ETH_RE.match(address):
        return "eth"
    return None


class CryptoModule(OsintModule):

    def __init__(self):
        super().__init__("crypto")

    def _parse_btc(self, address: str, data: dict) -> dict:
        balance_sat = data.get("final_balance", 0)
        received_sat = data.get("total_received", 0)
        sent_sat = data.get("total_sent", 0)

        txs = []
        for tx in data.get("txrefs", [])[:10]:
            txs.append({
                "hash": tx.get("tx_hash", ""),
                "block": tx.get("block_height"),
                "time": tx.get("confirmed"),
                "value": tx.get("value", 0) / 1e8,
                "spent": tx.get("spent", False),
                "tx_input_n": tx.get("tx_input_n", -1),
                "tx_output_n": tx.get("tx_output_n", -1),
            })

        return {
            "address": address,
            "type": "bitcoin",
            "balance": balance_sat / 1e8,
            "balance_raw": balance_sat,
            "total_received": received_sat / 1e8,
            "total_sent": sent_sat / 1e8,
            "tx_count": data.get("n_tx", 0),
            "unconfirmed_tx_count": data.get("unconfirmed_n_tx", 0),
            "unconfirmed_balance": data.get("unconfirmed_balance", 0) / 1e8,
            "first_seen": None,
            "last_seen": None,
            "transactions": txs,
        }

    def _parse_eth(self, address: str, data: dict) -> dict:
        balance_wei = data.get("final_balance", data.get("balance", 0))

        txs = []
        for tx in data.get("txrefs", [])[:10]:
            txs.append({
                "hash": tx.get("tx_hash", ""),
                "block": tx.get("block_height"),
                "time": tx.get("confirmed"),
                "value": tx.get("value", 0) / 1e18,
                "tx_input_n": tx.get("tx_input_n", -1),
                "tx_output_n": tx.get("tx_output_n", -1),
            })

        return {
            "address": address,
            "type": "ethereum",
            "balance": balance_wei / 1e18,
            "balance_raw": str(balance_wei),
            "total_received": data.get("total_received", 0) / 1e18,
            "total_sent": data.get("total_sent", 0) / 1e18,
            "tx_count": data.get("n_tx", 0),
            "first_seen": None,
            "last_seen": None,
            "transactions": txs,
        }

    async def search(self, query: str, socketio, namespace: str, **kwargs) -> dict:
        self.logger.info(f"Starting crypto lookup for: {query}")
        room = kwargs.get("room")
        cancel_event = kwargs.get("cancel_event")

        address = query.strip()

        try:
            self.emit_progress(socketio, namespace, 10, "Validating address...", room=room)

            addr_type = detect_address_type(address)
            if addr_type is None:
                error_msg = "Invalid address format. Provide a Bitcoin (1.../3.../bc1...) or Ethereum (0x...) address."
                self.emit_error(socketio, namespace, error_msg, room=room)
                return {"error": error_msg}

            if self.handle_cancellation(cancel_event):
                return {"error": "Search cancelled"}

            if addr_type == "btc":
                base = BLOCKCYPHER_BTC
                chain_label = "Bitcoin"
            else:
                base = BLOCKCYPHER_ETH
                chain_label = "Ethereum"

            url = f"{base}/addrs/{address}"
            self.emit_progress(socketio, namespace, 30, f"Querying BlockCypher for {chain_label} data...", room=room)

            response = await asyncio.to_thread(
                lambda: requests.get(url, timeout=15)
            )

            if self.handle_cancellation(cancel_event):
                return {"error": "Search cancelled"}

            self.emit_progress(socketio, namespace, 60, "Processing results...", room=room)

            if response.status_code == 429:
                error_msg = "Rate limit reached. Please wait a moment and try again."
                self.emit_error(socketio, namespace, error_msg, room=room)
                return {"error": error_msg}

            if response.status_code == 404:
                result = {
                    "result": {
                        "module": "crypto",
                        "results": {
                            "address": address,
                            "type": chain_label.lower(),
                            "found": False,
                        },
                    }
                }
                self.emit_result(socketio, namespace, result, room=room)
                return result

            response.raise_for_status()
            raw = response.json()

            self.emit_progress(socketio, namespace, 80, "Formatting results...", room=room)

            if addr_type == "btc":
                parsed = self._parse_btc(address, raw)
            else:
                parsed = self._parse_eth(address, raw)

            parsed["found"] = True

            result = {
                "result": {
                    "module": "crypto",
                    "results": parsed,
                }
            }

            self.emit_result(socketio, namespace, result, room=room)
            return result

        except requests.exceptions.Timeout:
            error_msg = "Request timed out"
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {"error": error_msg}

        except requests.exceptions.ConnectionError:
            error_msg = "Could not connect to BlockCypher API"
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {"error": error_msg}

        except Exception as e:
            error_msg = f"Error in crypto address lookup: {str(e)}"
            self.logger.error(error_msg)
            self.emit_error(socketio, namespace, error_msg, room=room)
            return {"error": error_msg}


crypto_module = CryptoModule()
