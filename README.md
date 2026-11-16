# Gmai: mail app (college project)

A mail app for Android (React Native / Expo) that looks and works like a modern mail app, built from a screen recording. It has its own server, database and admin panel, and is also controlled from the shared **Admin Hub** together with GGPay, PayTwin and PhonePayy.

> Demo project: mail is delivered **between addresses that exist in this app** (for example `name@gmai.app`, or company sender IDs the admin creates). It does not send to or receive from the real internet. Mail to an unknown address bounces back with "Address not found".

## What the app does

- **Inbox (Primary)** with Promotions, Social and Updates rows and "N new" chips, unread bold rows, stars, attachment chips.
- **Side menu**: All inboxes, Primary, Promotions, Social, Updates, Starred, Snoozed, Important, Purchases, Sent, Scheduled, Outbox, Drafts, All mail, Spam, Trash, your own labels, Create label, Settings, Help.
- **Several mail IDs on one phone**: tap the profile picture to switch accounts (each shows its unread count), add another account, or sign out of one.
- **Read a conversation**: earlier messages collapsed, "to me" details (From / To / Date / encryption), Summarize this email, attachments, suggested replies, Reply / Reply all / Forward, archive, delete, mark unread, move to a category, snooze, labels, report spam.
- **Compose**: choose which of your accounts to send **from**, To / Cc / Bcc with suggestions, photo attachments, schedule send, drafts saved automatically.
- **Search** with filter chips: Label, From, To, Attachment, Date, Is unread.
- **Live**: new mail appears instantly (Socket.io) with a snackbar.
- **Meet** tab (placeholder), Settings (name, photo, signature, password), Help.

## Admin panel (`/admin`, admin / admin123)

- **Mail IDs**: add people (who sign in) or company senders (e.g. `offers@freshmart.in`), choose whether their mail lands in Primary / Promotions / Social / Updates, reset passwords, suspend, delete.
- **Send mail**: send as any address (existing or new) to any addresses or to every user, with attachments and simple formatting (`# banner`, `**bold**`, `- bullets`).
- **Open a mailbox**: read any mail ID's folders and reply as that ID.
- **All messages**, **App settings** (name, domain, search text, announcement, maintenance, features on/off, logo, demo reset), **Audit logs**, **Admins**.

In the **Admin Hub**, Gmai's admin pages open inside the hub (the hub reads `GET /api/admin/schema`, which says `panel: "embed"`).

## Run locally

| Thing | Port | Start |
|---|---|---|
| Gmai server + admin | 4003 | `START-SERVER.bat` → <http://localhost:4003/admin> |
| App in Expo Go | 8084 | `START-APP.bat` |
| App in the browser | 8084 | `START-PREVIEW.bat` |

Demo sign-in: `akshay@gmai.app` / `demo123` (also `priya@`, `rahul@`, `socialmedia@`, `jayashree@`, `madhavi@` with `demo123`).

## Online

`render.yaml` deploys the server on Render (free plan) with its own MongoDB database (`MONGODB_DB=gmai`). Attachments are stored in a separate `files` collection. The APK is built with EAS (`eas build -p android --profile preview`).
