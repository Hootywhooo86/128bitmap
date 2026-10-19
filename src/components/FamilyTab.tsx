import { useEffect, useState } from "react";
import {
  canUseProviders,
  deleteFamilyAccount,
  familyEmail,
  onFamily,
  signInEmail,
  signInWith,
  signOutFamily,
  signUpEmail,
} from "../lib/family";

// Menu → ACCOUNT: the 128bit family account, the same sign-in as every 128bit app.
export function FamilyTab() {
  const [email, setEmail] = useState(familyEmail);
  const [mail, setMail] = useState("");
  const [pass, setPass] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => onFamily(() => setEmail(familyEmail())), []);

  const run = async (job: () => Promise<string | void>) => {
    setNote("");
    try {
      setNote((await job()) ?? "");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <div className="backup">
      <p>
        One sign-in for 128bitPlay, 128bitfit, 128bit Tracker and every 128bit app. Signed in, each trip you finish
        with guidance (how far, how long, walking, cycling or driving) shows on Tracker&apos;s timeline. Your places
        and routes stay on this device.
      </p>
      {email ? (
        <>
          <p className="dim">Signed in as {email}</p>
          <div className="backup-actions">
            <button className="pixel-btn" onClick={() => signOutFamily()}>
              SIGN OUT
            </button>
            <button
              className="pixel-btn"
              onClick={() => {
                if (confirm("Delete your 128bit family account? Everything every 128bit app sent to it is deleted for good."))
                  void run(async () => {
                    await deleteFamilyAccount();
                    return "Account deleted.";
                  });
              }}
            >
              DELETE ACCOUNT
            </button>
          </div>
        </>
      ) : (
        <>
          {canUseProviders() && (
            <div className="backup-actions">
              <button className="pixel-btn" onClick={() => void run(() => signInWith("google"))}>
                GOOGLE
              </button>
              <button className="pixel-btn" onClick={() => void run(() => signInWith("apple"))}>
                APPLE
              </button>
            </div>
          )}
          <input className="text-input" type="email" placeholder="Email" value={mail} onChange={(e) => setMail(e.target.value)} autoComplete="username" />
          <input className="text-input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
          <div className="backup-actions">
            <button className="pixel-btn" disabled={!mail || !pass} onClick={() => void run(async () => { await signInEmail(mail, pass); setPass(""); })}>
              SIGN IN
            </button>
            <button
              className="pixel-btn"
              disabled={!mail || pass.length < 6}
              onClick={() => void run(async () => ((await signUpEmail(mail, pass)) ? undefined : "Check your email for the confirmation link, then sign in."))}
            >
              CREATE
            </button>
          </div>
        </>
      )}
      {note && (
        <p className="note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
