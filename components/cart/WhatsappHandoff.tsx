"use client";

import { useState } from "react";

import { markWhatsappOpened } from "@/lib/actions/checkout";

/**
 * The handoff to WhatsApp.
 *
 * It is a link the customer clicks, not an automatic redirect. Opening a new
 * window without a user gesture is blocked by every current browser, and the
 * failure is silent — the customer would sit on a page that appears to be
 * doing nothing. A real button also means the reference above it has been seen
 * before anyone leaves.
 *
 * The message is shown as copyable text underneath for the cases where the
 * link cannot work at all: no WhatsApp installed, a desktop without WhatsApp
 * Web, or a corporate network blocking it.
 */
export function WhatsappHandoff({
  orderNumber,
  url,
  message,
  display,
  fresh,
}: {
  orderNumber: string;
  url: string;
  message: string;
  display: string;
  fresh: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    } catch {
      // Clipboard access can be refused (insecure context, permission policy).
      // The textarea below is the fallback, so just reveal it.
      setShowMessage(true);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 24, textAlign: "center" }}>
      <h2>{fresh ? "Send it to us" : "Message us about this order"}</h2>
      <p className="hint" style={{ maxWidth: "46ch", margin: "6px auto 22px" }}>
        This opens WhatsApp with your order already written out. We reply on{" "}
        {display}.
      </p>

      <a
        className="wa-btn"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        /* Fire-and-forget: this is what separates "pending, contacted us" from
           "pending, never opened WhatsApp" in the admin queue. Awaiting it
           would delay the navigation the customer asked for. */
        onClick={() => void markWhatsappOpened(orderNumber)}
      >
        Open WhatsApp
      </a>

      <p style={{ marginTop: 20 }}>
        <button
          type="button"
          className="line-remove"
          style={{ marginLeft: "auto", marginRight: "auto" }}
          onClick={() => setShowMessage((current) => !current)}
          aria-expanded={showMessage}
        >
          {showMessage ? "Hide the message" : "WhatsApp not working? Copy the message"}
        </button>
      </p>

      {showMessage ? (
        <div style={{ marginTop: 16, textAlign: "left" }}>
          <textarea
            className="msg-box"
            readOnly
            value={message}
            aria-label="Your order message"
            onFocus={(event) => event.currentTarget.select()}
          />
          <p style={{ marginTop: 12, textAlign: "center" }}>
            <button type="button" className="btn btn--ghost" onClick={copy}>
              {copied ? "Copied ✓" : "Copy message"}
            </button>
          </p>
          <p className="hint" style={{ marginTop: 10, textAlign: "center" }}>
            Paste it into a WhatsApp chat with {display}, or read us the reference
            over the phone.
          </p>
        </div>
      ) : null}
    </div>
  );
}
