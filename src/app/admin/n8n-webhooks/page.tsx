/**
 * N8N-Webhook-Verwaltung (Admin).
 *
 * Zwei Bereiche:
 *  - Eingehend: API-Keys fuer /api/deputate/sync
 *  - Ausgehend: Notification-Targets + Event-Abos
 */

import { requireAdmin } from "@/lib/auth/permissions";
import {
  listWebhookConfigs,
  listNotificationTargets,
  listRecentSyncLogs,
  listRecentNotifications,
} from "./actions";
import { N8nWebhooksClient } from "./N8nWebhooksClient";

export const metadata = {
  title: "N8N-Webhooks | CREDO Verwaltung",
};

export default async function N8nWebhooksPage() {
  await requireAdmin();

  const [configs, targets, syncLogs, notifLogs] = await Promise.all([
    listWebhookConfigs(),
    listNotificationTargets(),
    listRecentSyncLogs(50),
    listRecentNotifications({ limit: 100 }),
  ]);

  return (
    <N8nWebhooksClient
      initialConfigs={configs}
      initialTargets={targets}
      initialSyncLogs={syncLogs}
      initialNotifLogs={notifLogs}
    />
  );
}
