-- Starting store settings. Bank details are blank until set in the admin.
INSERT INTO store_settings (id, data) VALUES (1, '{
  "bankName": "",
  "accountName": "",
  "accountNumber": "",
  "phone": "0901 720 2788",
  "whatsapp": "2349017202788",
  "email": "pastryuniversee@gmail.com",
  "instagram": "pastryuniverse",
  "address": "8b Adefeyisan Street, Olawaiye Estate, Olowora, Lagos",
  "pickupAddress": "No. 10 Johnson Street, Kajola, Ojodu Berger",
  "pickupNote": "Please call 0901 720 2788 before you come.",
  "leadDays": 1,
  "maxDaysAhead": 21,
  "closedWeekdays": [],
  "timeSlots": ["9am – 12pm", "12pm – 3pm", "3pm – 6pm"],
  "ticker": ["Fresh banana bread", "Premium quality snacks for premium clients", "Delivery across Lagos", "Birthday banana cakes", "Chin-chin by the bucket", "Pickup in Ojodu Berger"],
  "announcement": "",
  "shopOpen": true
}'::jsonb);
