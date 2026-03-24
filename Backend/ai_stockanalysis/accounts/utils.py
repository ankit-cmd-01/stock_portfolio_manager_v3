# accounts/utils.py

import asyncio
import logging
import random
import string

from django.conf import settings
from django.utils import timezone

try:
    from telethon import TelegramClient
    from telethon.tl.functions.contacts import ImportContactsRequest
    from telethon.tl.types import InputPhoneContact
except ImportError:
    TelegramClient = None
    ImportContactsRequest = None
    InputPhoneContact = None

logger = logging.getLogger(__name__)


def generate_otp():
    return "".join(random.choices(string.digits, k=6))


def save_otp(user, purpose):
    otp = generate_otp()

    user.otp_code = otp
    user.otp_created_at = timezone.now()
    user.otp_is_used = False
    user.otp_purpose = purpose
    user.save(
        update_fields=[
            "otp_code",
            "otp_created_at",
            "otp_is_used",
            "otp_purpose",
        ]
    )

    return otp


async def async_send_telegram(phone_number, otp):
    """
    Actual async function that sends OTP via Telethon.
    """
    normalized_phone = phone_number.replace(" ", "")

    async with TelegramClient(
        str(settings.BASE_DIR / "session"),
        settings.TELEGRAM_API_ID,
        settings.TELEGRAM_API_HASH,
    ) as client:
        contact = InputPhoneContact(
            client_id=0,
            phone=normalized_phone,
            first_name="User",
            last_name="",
        )
        result = await client(ImportContactsRequest([contact]))
        if not result.users:
            raise ValueError(f"No Telegram account found for {normalized_phone}.")

        message = (
            f"Your OTP is: {otp}\n\n"
            "Valid for 5 minutes only.\n"
            "Do NOT share this with anyone!"
        )
        await client.send_message(result.users[0], message)


def send_otp_via_telegram(phone_number, otp):
    """
    Wrapper that handles event loop for Django threads.
    """
    if TelegramClient is None:
        logger.warning("Telethon is not installed.")
        return False

    if not settings.TELEGRAM_API_ID or not settings.TELEGRAM_API_HASH:
        logger.warning("Telegram credentials are not configured.")
        return False

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(async_send_telegram(phone_number, otp))
        loop.close()

        logger.info("OTP sent to %s via Telegram.", phone_number)
        return True
    except Exception:
        logger.exception("Failed to send OTP via Telegram.")
        return False


def generate_and_send_otp(user, purpose):
    otp = save_otp(user, purpose)
    success = send_otp_via_telegram(user.phone_number, otp)
    return success
