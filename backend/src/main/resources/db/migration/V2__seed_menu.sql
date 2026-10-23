-- Pastry Universe menu, seeded from the store as of October 2026.
-- Edit products in the admin; this only runs once on a fresh database.

INSERT INTO products (slug, name, category, tag, description, sort_order) VALUES ('banana-bread', 'Banana Bread', 'Banana bread', 'Bestseller', 'Our classic loaf. Get it plain or topped with raisins, coconut chips, chocolate chips or almond nuts. The mini feeds one person.', 1);
INSERT INTO variants (product_id, size_key, size_label, size_sort, option_label, option_sort, price, available) VALUES
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'mini', 'Mini', 1, 'No toppings', 1, 2000, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'mini', 'Mini', 1, 'Raisins', 2, 2000, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'mini', 'Mini', 1, 'Almond nuts', 3, 2000, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'mini', 'Mini', 1, 'Chocolate chips', 4, 2000, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'mini', 'Mini', 1, 'Coconut chips', 5, 2000, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'medium', 'Medium', 2, 'No toppings', 1, 3000, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'medium', 'Medium', 2, 'Coconut chips', 2, 3500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'medium', 'Medium', 2, 'Chocolate chips', 3, 3500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'medium', 'Medium', 2, 'Raisins', 4, 3500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'medium', 'Medium', 2, 'Almond nuts', 5, 3500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'large', 'Large', 3, 'Raisins', 1, 7500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'large', 'Large', 3, 'Coconut chips', 2, 7500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'large', 'Large', 3, 'Chocolate chips', 3, 7500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'large', 'Large', 3, 'Almond nuts', 4, 7500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'large', 'Large', 3, 'No toppings', 5, 7500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'pan', 'Pan-sized', 4, '', 1, 8000, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'jumbo', 'Jumbo', 5, 'No toppings', 1, 15000, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'jumbo', 'Jumbo', 5, 'Raisins and coconut chips', 2, 16500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'jumbo', 'Jumbo', 5, 'Coconut chips and almond nuts', 3, 16500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'jumbo', 'Jumbo', 5, 'Chocolate chips and raisins', 4, 16500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'family', 'Family tray', 6, 'No toppings', 1, 19000, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'family', 'Family tray', 6, 'Raisins, coconut chips and chocolate chips', 2, 22500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'family', 'Family tray', 6, 'Coconut chips, almond nuts and chocolate chips', 3, 22500, true),
  ((SELECT id FROM products WHERE slug = 'banana-bread'), 'family', 'Family tray', 6, 'Chocolate chips, raisins and almond nuts', 4, 22500, true);

INSERT INTO products (slug, name, category, tag, description, sort_order) VALUES ('birthday', 'Birthday Banana Cake', 'Cakes', NULL, 'Loaded with assorted nuts inside and covered with chocolate or any other topping. Made for birthdays and gifts.', 2);
INSERT INTO variants (product_id, size_key, size_label, size_sort, option_label, option_sort, price, available) VALUES
  ((SELECT id FROM products WHERE slug = 'birthday'), '7in', '7-inch', 1, '', 1, 21750, true),
  ((SELECT id FROM products WHERE slug = 'birthday'), '8in', '8-inch', 2, '', 1, 18750, true),
  ((SELECT id FROM products WHERE slug = 'birthday'), '12in', '12-inch square', 3, '', 1, 48500, true),
  ((SELECT id FROM products WHERE slug = 'birthday'), 'double', 'Double layer', 4, '', 1, 48500, true);

INSERT INTO products (slug, name, category, tag, description, sort_order) VALUES ('oats', 'Oats Banana Bread', 'Banana bread', 'Fitfam', 'Made with oats and other natural ingredients, for anyone on a fitfam journey.', 3);
INSERT INTO variants (product_id, size_key, size_label, size_sort, option_label, option_sort, price, available) VALUES
  ((SELECT id FROM products WHERE slug = 'oats'), 'mini', 'Mini', 1, 'No toppings', 1, 2500, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'mini', 'Mini', 1, 'Raisins', 2, 2800, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'mini', 'Mini', 1, 'Sesame seeds', 3, 2800, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'mini', 'Mini', 1, 'Coconut chips', 4, 2800, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'mini', 'Mini', 1, 'Almond nuts', 5, 2800, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'mini', 'Mini', 1, 'Chocolate chips', 6, 2800, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'medium', 'Medium', 2, 'No toppings', 1, 4000, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'medium', 'Medium', 2, 'Almond nuts and coconut chips', 2, 4500, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'medium', 'Medium', 2, 'Coconut chips and raisins', 3, 4500, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'medium', 'Medium', 2, 'Almond nuts and raisins', 4, 4500, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'medium', 'Medium', 2, 'Chocolate chips', 5, 4500, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'medium', 'Medium', 2, 'Sesame seeds and raisins', 6, 4500, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'large', 'Large', 3, 'No toppings', 1, 6000, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'large', 'Large', 3, 'Coconut chips', 2, 6700, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'large', 'Large', 3, 'Groundnuts', 3, 6700, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'large', 'Large', 3, 'Almond nuts', 4, 6700, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'large', 'Large', 3, 'Raisins', 5, 6700, true),
  ((SELECT id FROM products WHERE slug = 'oats'), 'large', 'Large', 3, 'Chocolate chips', 6, 6700, true);

INSERT INTO products (slug, name, category, tag, description, sort_order) VALUES ('petit-box', 'Petit Loaf Box', 'Gift boxes', 'Gift', 'Six mini banana breads with different exotic toppings. Perfect for gifting friends and loved ones, with a handwritten note if you like.', 4);
INSERT INTO variants (product_id, size_key, size_label, size_sort, option_label, option_sort, price, available) VALUES
  ((SELECT id FROM products WHERE slug = 'petit-box'), 'regular', 'Regular', 1, 'Handwritten note', 1, 20100, true),
  ((SELECT id FROM products WHERE slug = 'petit-box'), 'regular', 'Regular', 1, 'No note', 2, 18500, true);

INSERT INTO products (slug, name, category, tag, description, sort_order) VALUES ('chinchin', 'Chin-Chin', 'Chin-chin', NULL, 'Delicious, crunchy chin-chin, plain or peppered.', 5);
INSERT INTO variants (product_id, size_key, size_label, size_sort, option_label, option_sort, price, available) VALUES
  ((SELECT id FROM products WHERE slug = 'chinchin'), '200g', '200g pouch', 1, 'Plain', 1, 2000, true),
  ((SELECT id FROM products WHERE slug = 'chinchin'), '200g', '200g pouch', 1, 'Peppered', 2, 2200, true),
  ((SELECT id FROM products WHERE slug = 'chinchin'), '400g', '400g pouch', 2, 'Plain', 1, 3200, true),
  ((SELECT id FROM products WHERE slug = 'chinchin'), '400g', '400g pouch', 2, 'Peppered', 2, 3500, true),
  ((SELECT id FROM products WHERE slug = 'chinchin'), '1kg', '1kg half bucket', 3, 'Plain', 1, 8500, true),
  ((SELECT id FROM products WHERE slug = 'chinchin'), '1kg', '1kg half bucket', 3, 'Peppered', 2, 8900, true),
  ((SELECT id FROM products WHERE slug = 'chinchin'), '2kg', '2kg paint bucket', 4, 'Plain', 1, 18000, true),
  ((SELECT id FROM products WHERE slug = 'chinchin'), '2kg', '2kg paint bucket', 4, 'Peppered', 2, 19000, true);

INSERT INTO products (slug, name, category, tag, description, sort_order) VALUES ('lemon', 'Lemon Infused Banana Bread', 'Banana bread', NULL, 'Banana bread infused with fresh lemon juice and lemon rind.', 6);
INSERT INTO variants (product_id, size_key, size_label, size_sort, option_label, option_sort, price, available) VALUES
  ((SELECT id FROM products WHERE slug = 'lemon'), 'mini', 'Mini', 1, 'No toppings', 1, 1900, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'mini', 'Mini', 1, 'Raisins', 2, 2200, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'mini', 'Mini', 1, 'Banana toppings', 3, 2200, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'mini', 'Mini', 1, 'Coconut chips', 4, 2200, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'mini', 'Mini', 1, 'Chocolate chips', 5, 2200, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'medium', 'Medium', 2, 'No toppings', 1, 3000, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'medium', 'Medium', 2, 'Raisins', 2, 3500, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'medium', 'Medium', 2, 'Banana toppings', 3, 3500, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'medium', 'Medium', 2, 'Coconut chips', 4, 3500, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'medium', 'Medium', 2, 'Chocolate chips', 5, 3500, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'large', 'Large', 3, 'No toppings', 1, 5200, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'large', 'Large', 3, 'Raisins', 2, 6000, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'large', 'Large', 3, 'Banana toppings', 3, 6000, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'large', 'Large', 3, 'Coconut chips', 4, 6000, true),
  ((SELECT id FROM products WHERE slug = 'lemon'), 'large', 'Large', 3, 'Chocolate', 5, 6000, true);

INSERT INTO products (slug, name, category, tag, description, sort_order) VALUES ('red-velvet', 'Red Velvet Cake', 'Cakes', NULL, 'Succulent, moist red dessert cake.', 7);
INSERT INTO variants (product_id, size_key, size_label, size_sort, option_label, option_sort, price, available) VALUES
  ((SELECT id FROM products WHERE slug = 'red-velvet'), 'mini', 'Mini', 1, '', 1, 2000, true),
  ((SELECT id FROM products WHERE slug = 'red-velvet'), 'medium', 'Medium', 2, '', 1, 3000, true);

INSERT INTO products (slug, name, category, tag, description, sort_order) VALUES ('cubed', 'Cubed Chin-Chin', 'Chin-chin', NULL, 'Cut into cubes. Delicious and crunchy, plain or peppered.', 8);
INSERT INTO variants (product_id, size_key, size_label, size_sort, option_label, option_sort, price, available) VALUES
  ((SELECT id FROM products WHERE slug = 'cubed'), '200g', '200g pouch', 1, 'Plain', 1, 1700, true),
  ((SELECT id FROM products WHERE slug = 'cubed'), '200g', '200g pouch', 1, 'Peppered', 2, 2000, true),
  ((SELECT id FROM products WHERE slug = 'cubed'), '400g', '400g pouch', 2, 'Plain', 1, 3500, true),
  ((SELECT id FROM products WHERE slug = 'cubed'), '400g', '400g pouch', 2, 'Peppered', 2, 3900, true),
  ((SELECT id FROM products WHERE slug = 'cubed'), '1kg', '1kg half bucket', 3, 'Plain', 1, 8500, true),
  ((SELECT id FROM products WHERE slug = 'cubed'), '1kg', '1kg half bucket', 3, 'Peppered', 2, 8900, true),
  ((SELECT id FROM products WHERE slug = 'cubed'), '2kg', '2kg paint bucket', 4, 'Plain', 1, 16500, true),
  ((SELECT id FROM products WHERE slug = 'cubed'), '2kg', '2kg paint bucket', 4, 'Peppered', 2, 17500, true);

INSERT INTO products (slug, name, category, tag, description, sort_order) VALUES ('dates', 'Dates Powder Bread', 'Banana bread', 'No sugar', 'Made with whole wheat flour and dates powder, with no sugar added.', 9);
INSERT INTO variants (product_id, size_key, size_label, size_sort, option_label, option_sort, price, available) VALUES
  ((SELECT id FROM products WHERE slug = 'dates'), 'regular', 'Regular', 1, 'Coconut chips', 1, 2050, true),
  ((SELECT id FROM products WHERE slug = 'dates'), 'regular', 'Regular', 1, 'Almond nuts', 2, 2050, true),
  ((SELECT id FROM products WHERE slug = 'dates'), 'regular', 'Regular', 1, 'Chocolate chips', 3, 2050, true),
  ((SELECT id FROM products WHERE slug = 'dates'), 'regular', 'Regular', 1, 'Raisins', 4, 2050, true);

INSERT INTO delivery_zones (name, areas, fee, sort_order) VALUES
  ('Ojodu / Omole Phase 1&2 / Magodo phase 1 / Olowora', 'Deliveries to Ojodu /Omole Phase 1&2 /Magodo phase 1 /Olowora', 2000, 1),
  ('Ikeja', '', 2500, 2),
  ('Ogba / Magodo Shangisha', 'To Ogba and Magodo Shangisha', 2500, 3),
  ('Agege / Maryland / Ogudu', 'Deliveries to Ikeja, Agege, Maryland and Ogudu Axis', 3000, 4),
  ('Ikosi / Ketu / Alapere / Maryland / Oworo / Ilupeju', 'Deliveries Ikosi /Ketu /Alapere /Maryland /Oworo /Ilupeju', 3000, 5),
  ('Opic Estate', 'Deliveries to Opic Estate', 3000, 6),
  ('Iyana Ipaja / Egbeda', 'To Iyana-Ipaja and Egbeda', 3500, 7),
  ('Ojokoro / Command / Iju fagba / Abule egba', 'Deliveries to Ojokoro /Command /Iju fagba / Abule egba', 3500, 8),
  ('Akoka / Oyingbo / Costain / Iganmu', 'Deliveries to /Akoka /Oyingbo /Costain /Iganmu', 4000, 9),
  ('Bariga / Shomolu / Yaba / Oshodi / Mushin', 'Deliveries to Bariga /Shomolu /Yaba /Oshodi /Mushin', 4000, 10),
  ('Igando / Ikotun / Idimu / Ejigbo / Ipaja', 'To Igando, Ikotun, Ejigbo, Ipaja Axis', 4000, 11),
  ('Yaba / Surulere / Shomolu / Bariga', 'To Yaba, Surulere, Shomolu and Bariga', 4000, 12),
  ('Alakuko', 'Deliveries to Alakuko', 4500, 13),
  ('Ijegun / Ago palace', 'To Ijegun and Ago-palace axis', 4500, 14),
  ('Ikorodu', 'Deliveries to Ikorodu', 4500, 15),
  ('Apapa', 'Deliveries to Apapa Axis', 5000, 16),
  ('Festac town', 'Deliveries to Festac town Axis', 5000, 17),
  ('Festac Town / Ayobo', 'To Festac Town and Ayobo axis', 5000, 18),
  ('Lagos Island / VI', 'Deliveries to Lagos Island /VI', 5000, 19),
  ('Lekki phase 1', 'Deliveries to Lekki phase 1', 5500, 20),
  ('Chevron / Lekki phase 2', 'Deliveries to Chevron /Lekki phase 2', 6000, 21),
  ('Satelite town', 'Delivery to Satellite town', 6000, 22),
  ('Ajah / Ikota / Orchid Road / VGC', 'Deliveries to Ajah /Ikota /Orchid Road /VGC', 7000, 23),
  ('Sangotedo', 'Deliveries to Sangotedo', 8000, 24),
  ('Awoyaya', 'Deliveries to Awoyaya Axis', 9000, 25),
  ('Ibeju Lekki', 'Ibeju Lekki axis', 12000, 26),
  ('Epe', 'Deliveries to Epe axis', 15000, 27);
