import {
  useSpToken,
  sendSPNotification,
  useOnForeground,
} from "socketpush-web";
export async function sendEvent(token: string, event: string, data: string) {
  await sendSPNotification(token, {
    title: event,
    message: data,
  });
}

export function useEvent(callback: (event: string, data: string) => void) {
  useOnForeground((payload) => {
    console.log(payload);
    const event = payload.notification.title;
    const data = payload.notification.body;
    callback(event, data);
  });
}
