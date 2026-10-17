from workers.whatsapp import template_parameters, whatsapp_config


def test_template_parameters_are_kind_specific_and_bounded():
    title, detail = template_parameters(
        "club_day.announced",
        {"club_name": "Robotics", "title": "Build night", "day_date": "2026-10-20"},
    )

    assert title == "A Club Day was announced"
    assert detail == "Build night · 2026-10-20"
    assert len(template_parameters("unknown", {"title": "x" * 1000})[1]) == 120


def test_whatsapp_configuration_stays_disabled_until_complete(monkeypatch):
    for name in (
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_GRAPH_API_VERSION",
        "WHATSAPP_TEMPLATE_NAME",
    ):
        monkeypatch.delenv(name, raising=False)
    assert whatsapp_config() is None


def test_whatsapp_configuration_builds_versioned_cloud_api_url(monkeypatch):
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "test-token")
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "123456789")
    monkeypatch.setenv("WHATSAPP_GRAPH_API_VERSION", "v23.0")
    monkeypatch.setenv("WHATSAPP_TEMPLATE_NAME", "club_update")
    monkeypatch.setenv("WHATSAPP_TEMPLATE_LANGUAGE", "en_US")

    config = whatsapp_config()

    assert config["url"] == "https://graph.facebook.com/v23.0/123456789/messages"
    assert config["template"] == "club_update"
    assert config["language"] == "en_US"


def test_whatsapp_configuration_builds_bridge_url(monkeypatch):
    monkeypatch.setenv("WHATSAPP_BRIDGE_URL", "http://127.0.0.1:3001")
    config = whatsapp_config()
    assert config["mode"] == "bridge"
    assert config["url"] == "http://127.0.0.1:3001/send"
    assert config["status_url"] == "http://127.0.0.1:3001/status"


def test_whatsapp_configuration_builds_mock_url(monkeypatch):
    monkeypatch.setenv("WHATSAPP_MODE", "mock")
    config = whatsapp_config()
    assert config["mode"] == "mock"
    assert config["url"] == "mock://whatsapp"


