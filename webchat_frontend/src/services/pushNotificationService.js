import api from './api';

const VAPID_KEY_URL = '/api/notifications/vapid-public-key';
const SUBSCRIPTIONS_URL = '/api/notifications/subscriptions';
const SERVICE_WORKER_PATH = '/sw.js';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const buffersEqual = (a, b) => {
  if (!a || !b) return false;
  const arrA = new Uint8Array(a);
  const arrB = new Uint8Array(b);
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i += 1) {
    if (arrA[i] !== arrB[i]) return false;
  }
  return true;
};

// Single in-flight promise so concurrent callers collapse onto one negotiation.
let inFlight = null;
let maintenanceStarted = false;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const refreshSubscriptionIfGranted = () => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return Promise.resolve();
  }
  return ensureSubscriptionImpl().catch((error) => {
    console.warn('[push] subscription refresh failed:', error);
  });
};

const ensureSubscriptionImpl = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] Service workers or PushManager not supported in this browser');
    return;
  }

  console.info('[push] step 1/7 registering service worker', SERVICE_WORKER_PATH);
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  try {
    await registration.update();
  } catch (err) {
    console.warn('[push] SW update check failed:', err);
  }

  console.info('[push] step 2/7 waiting for service worker to activate');
  await navigator.serviceWorker.ready;

  console.info('[push] step 3/7 requesting notification permission');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[push] notification permission not granted:', permission);
    return;
  }

  console.info('[push] step 4/7 fetching VAPID public key');
  let vapidResponse;
  try {
    vapidResponse = await api.get(VAPID_KEY_URL);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 503 || status === 502 || status === 504) {
      console.warn('[push] notification service unavailable; skipping web push setup');
      return;
    }
    throw err;
  }
  const publicKey = vapidResponse?.data?.publicKey;
  if (!publicKey) {
    console.warn('[push] backend did not return a VAPID public key');
    return;
  }
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  console.info('[push] step 5/7 reading current pushManager subscription');
  let subscription = await registration.pushManager.getSubscription();
  let previousEndpoint = null;

  if (subscription) {
    const existingKey = subscription.options?.applicationServerKey;
    const matches = existingKey ? buffersEqual(existingKey, applicationServerKey) : true;
    if (!matches) {
      previousEndpoint = subscription.endpoint;
      try {
        await subscription.unsubscribe();
      } catch {
        /* ignored */
      }
      subscription = null;
    }
  }

  if (!subscription) {
    console.info('[push] step 6/7 calling pushManager.subscribe()');
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    } catch (err) {
      // This is the typical failure mode in private/incognito browsing
      // contexts (Edge InPrivate, Chrome Incognito, Firefox Private).
      // Surface it loudly instead of silently swallowing.
      console.error('[push] pushManager.subscribe() failed — this browser context likely does not support web push (e.g. InPrivate / Incognito):', err);
      throw err;
    }
  } else {
    console.info('[push] step 6/7 reusing existing subscription');
  }

  if (!subscription || !subscription.endpoint) {
    console.error('[push] pushManager returned a null/empty subscription — web push is unavailable in this browser context');
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('[push] no auth token in localStorage; will retry once user is authenticated');
    return;
  }

  const body = subscription.toJSON();
  if (previousEndpoint && previousEndpoint !== body.endpoint) {
    body.previousEndpoint = previousEndpoint;
  }

  console.info('[push] step 7/7 POSTing subscription to backend', {
    endpoint: body.endpoint,
    rotated: Boolean(previousEndpoint),
  });
  try {
    await api.post(SUBSCRIPTIONS_URL, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('[push] backend rejected subscription POST', {
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
    });
    throw err;
  }

  console.info('[push] subscription registered successfully', {
    endpoint: body.endpoint,
  });
};

const pushNotificationService = {
  async ensureSubscription() {
    if (inFlight) {
      return inFlight;
    }
    inFlight = ensureSubscriptionImpl().finally(() => {
      inFlight = null;
    });
    return inFlight;
  },

  startMaintenance() {
    if (maintenanceStarted || typeof window === 'undefined') {
      return () => {};
    }
    maintenanceStarted = true;

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshSubscriptionIfGranted();
      }
    };
    const onFocus = () => {
      void refreshSubscriptionIfGranted();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    const intervalId = window.setInterval(() => {
      void refreshSubscriptionIfGranted();
    }, REFRESH_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
      maintenanceStarted = false;
    };
  },
};

export default pushNotificationService;
