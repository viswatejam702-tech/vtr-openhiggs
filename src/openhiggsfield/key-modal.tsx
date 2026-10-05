"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { clearPlatformCredentials, savePlatformCredentials } from "@/generation/actions";

import { CloseIcon } from "./icons";
import { BorderBeam, MetalFx } from "./effects";

export function KeyModal({
  configured,
  onClose,
  onSaved,
  onCleared,
}: {
  configured: boolean;
  onClose: () => void;
  onSaved: () => void;
  onCleared: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    panelRef.current?.focus();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await savePlatformCredentials({ api_key: apiKey });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the key");
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    setBusy(true);
    setError(null);
    try {
      await clearPlatformCredentials();
      setApiKey("");
      onCleared();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the key");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="ohf-keys-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className="ohf-dialog-panel ohf-keys-panel">
        <div className="ohf-keys-head">
          <div>
            <div id="ohf-keys-title" className="ohf-keys-title">
              API key
            </div>
            <p className="ohf-keys-copy">
              {configured
                ? "A key is saved in this browser. Enter a new id:secret pair to replace it."
                : "Paste your platform key as id:secret. It stays in an httpOnly cookie and is sent as Authorization: Key id:secret."}
            </p>
          </div>
          <button type="button" className="ohf-icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon size={13} />
          </button>
        </div>

        <form className="ohf-keys-form" onSubmit={(event) => void onSubmit(event)}>
          <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(209, 254, 23, 0.08)", border: "1px solid rgba(209, 254, 23, 0.25)", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "#d1fe17", fontWeight: 600, fontSize: "13px" }}>⚡ Free Generation Mode</span>
              <span style={{ fontSize: "11px", color: "#888" }}>Zero cost · No key required</span>
            </div>
            <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#ccc", lineHeight: "1.4" }}>
              Generate real live videos and images powered by Flux &amp; AI video engines for free without requiring a paid subscription.
            </p>
            <BorderBeam size="sm" colorVariant="sunset" strength={0.7} active={true}>
              <MetalFx preset="gold" variant="button" strength={1}>
                <button
                  type="button"
                  disabled={busy}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#d1fe17",
                    color: "#0a0a0b",
                    fontWeight: 700,
                    fontSize: "12px",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await savePlatformCredentials({ api_key: "free:free" });
                      onSaved();
                    } catch (caught) {
                      setError(caught instanceof Error ? caught.message : "Could not activate free mode");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Activating…" : "✨ Activate Free Mode Now"}
                </button>
              </MetalFx>
            </BorderBeam>
          </div>

          <label className="ohf-field">
            <div className="ohf-field-label">Custom API Key (Optional)</div>
            <input
              className="ohf-input ohf-input--mono"
              name="api_key"
              type="password"
              placeholder="Paste OpenRouter (sk-or-...), Higgsfield id:secret, or free"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </label>

          <div style={{ margin: "12px 0 16px 0", fontSize: "11px", color: "#888", lineHeight: "1.6" }}>
            <div style={{ fontWeight: 600, color: "#aaa", marginBottom: "4px" }}>Recommended free API providers:</div>
            • <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: "#d1fe17", textDecoration: "underline" }}>OpenRouter Free Tier Keys</a> (Free models &amp; video generation)<br />
            • <a href="https://pollinations.ai" target="_blank" rel="noreferrer" style={{ color: "#d1fe17", textDecoration: "underline" }}>Pollinations.ai</a> (100% Free unlimited images &amp; media)<br />
            • <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" style={{ color: "#d1fe17", textDecoration: "underline" }}>Hugging Face Tokens</a> (Free serverless models)<br />
            • <a href="https://open.higgsfield.ai" target="_blank" rel="noreferrer" style={{ color: "#d1fe17", textDecoration: "underline" }}>Higgsfield Starter Key</a> (Trial credits)
          </div>

          {error && (
            <div className="ohf-alert" role="alert">
              <span className="ohf-alert-text">{error}</span>
            </div>
          )}

          <div className="ohf-keys-actions">
            {configured && (
              <button type="button" className="ohf-btn-quiet" disabled={busy} onClick={() => void onClear()}>
                Remove key
              </button>
            )}
            <button type="submit" className="ohf-keys-save" disabled={busy || !apiKey.trim()}>
              {busy ? "Saving…" : configured ? "Replace key" : "Save key"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}