WITH picked AS (
  SELECT c.id AS camp_id,
         row_number() OVER (PARTITION BY c.district_code ORDER BY c.checkin_count DESC, c.name) AS rn
  FROM public.camps c
  WHERE c.verification_state IN ('unverified','verified')
    AND NOT EXISTS (SELECT 1 FROM public.camp_needs n WHERE n.camp_id = c.id)
),
target AS (
  SELECT camp_id, rn FROM picked WHERE rn <= 25
),
catalogue(item_key, unit, ord) AS (
  VALUES
    ('rice','kg',1),
    ('cooked_food','meals',2),
    ('drinking_water','cans',3),
    ('blankets','pcs',4),
    ('mats','pcs',5),
    ('clothes','sets',6),
    ('sanitary_pads','packs',7),
    ('baby_food','packs',8),
    ('medicines','kits',9),
    ('toiletries','kits',10),
    ('utensils','sets',11),
    ('footwear','pairs',12)
),
expanded AS (
  SELECT t.camp_id,
         c.item_key,
         c.unit,
         ((t.rn * 7 + c.ord * 13) % 12) AS spread,
         c.ord
  FROM target t
  JOIN catalogue c ON ((t.rn + c.ord) % 12) < 6
)
INSERT INTO public.camp_needs (camp_id, item_key, unit, needed_qty, pledged_qty, urgency)
SELECT camp_id,
       item_key,
       unit,
       20 + spread * 15 AS needed_qty,
       CASE WHEN spread % 3 = 0 THEN 0 ELSE LEAST(20 + spread * 15, spread * 6) END AS pledged_qty,
       CASE WHEN spread % 7 = 0 THEN 'critical'::urgency_level
            WHEN spread % 3 = 0 THEN 'high'::urgency_level
            ELSE 'normal'::urgency_level END
FROM expanded;