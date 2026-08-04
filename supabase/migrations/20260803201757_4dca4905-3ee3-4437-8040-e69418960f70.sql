WITH picked AS (
  SELECT id, row_number() OVER (ORDER BY district_code, name) AS rn
  FROM public.camps
  WHERE latitude IS NOT NULL
  ORDER BY district_code, name
  LIMIT 60
), items AS (
  SELECT * FROM (VALUES
    ('rice','kg',300),('cooked_food','meals',200),('drinking_water','cans',80),
    ('blankets','pcs',120),('mats','pcs',100),('clothes','sets',90),
    ('sanitary_pads','packs',60),('baby_food','packs',40),('medicines','kits',25),
    ('toiletries','kits',70),('utensils','sets',50),('footwear','pairs',60)
  ) AS v(item_key, unit, base)
), numbered AS (
  SELECT item_key, unit, base, row_number() OVER () AS i FROM items
)
INSERT INTO public.camp_needs (camp_id, item_key, unit, needed_qty, pledged_qty, urgency)
SELECT p.id,
       n.item_key,
       n.unit,
       GREATEST(10, (n.base * (0.5 + ((p.rn * 7 + n.i * 13) % 10) / 10.0))::int) AS needed_qty,
       ((n.base * (((p.rn * 3 + n.i * 5) % 6) / 10.0))::int) AS pledged_qty,
       CASE WHEN (p.rn + n.i) % 11 = 0 THEN 'critical'::urgency_level
            WHEN (p.rn + n.i) % 4 = 0 THEN 'high'::urgency_level
            ELSE 'normal'::urgency_level END
FROM picked p
JOIN numbered n ON n.i <= 5 + ((p.rn * 3) % 5)
ON CONFLICT DO NOTHING;