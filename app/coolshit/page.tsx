"use client";
import { useState } from "react";
import {
  useSpToken,
  sendSPNotification,
  useOnForeground,
} from "socketpush-web";
export default function Page() {
  const token = useSpToken();
  const [sendToken, setSendToken] = useState("");
  useOnForeground((payload) => {
    console.log(payload);
    alert("App is in foreground" + payload.notification.title);
  });
  return (
    <>
      <div>{token}</div>
      <input
        type="text"
        name=""
        id=""
        onChange={(e) => {
          setSendToken(e.target.value);
        }}
      />
      <button
        onClick={() => {
          sendNotification(sendToken);
        }}
      >
        Send Notofication
      </button>
    </>
  );
}

async function sendNotification(token: string) {
  sendSPNotification(token, {
    title: "Hello",
    message: "Hello world",
  });
}
