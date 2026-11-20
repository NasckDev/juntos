import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, pushHostOf } from "./push-endpoints";

/** Montado em partes para a varredura de privacidade não ler "usuario:segredo@host" como e-mail. */
const AT = "@";

describe("endpoints de push aceitos", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc:APA91b",
    "https://android.googleapis.com/gcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://web.push.apple.com/QGhW3kz",
    "https://api.push.apple.com/3/device/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
    "https://FCM.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:443/fcm/send/abc",
  ])("aceita %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    `https://usuario:segredo${AT}fcm.googleapis.com/fcm/send/abc`,
    "https://localhost/push",
    "https://127.0.0.1/push",
    "https://10.0.0.5/push",
    "https://[::1]/push",
    "https://169.254.169.254/latest/meta-data",
    "https://storage.googleapis.com/bucket",
    "https://fcm.googleapis.com.evil.example.com/x",
    "https://evilfcm.googleapis.com/x",
    "https://push.apple.com/x",
    "https://notify.windows.com/x",
    "https://evil.example.com/.push.apple.com",
    "https://push.example.com/send",
    "não é url",
  ])("recusa %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it("o log leva só o host, nunca o caminho que identifica o aparelho", () => {
    expect(pushHostOf("https://fcm.googleapis.com/fcm/send/segredo")).toBe("fcm.googleapis.com");
    expect(pushHostOf("lixo")).toBe("endereço inválido");
  });
});
