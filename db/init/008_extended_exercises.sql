-- ============================================================
-- 008: Genisletilmis Hibrit Atlet Egzersiz Kutuphanesi
--
-- Kaynak liste uyarlanirken yapilan duzeltmeler:
-- 1. Mevcut katalogla mukerrer hareketler ayiklandi (back_squat,
--    bench_press, HYROX istasyonlari, kosu tipleri vb. zaten var).
-- 2. Kas anahtarlari mevcut motor sozlugune normalize edildi:
--    latissimus_dorsi -> lats, trapezius -> traps,
--    shoulders -> front_delts / side_delts.
--    (Haftalik 22 set esigi kas anahtari bazinda toplanir; karisik
--    anahtar ayni kasi iki kovaya boler ve uyariyi bozar.)
-- 3. cns_load_factor degerleri mevcut kalibrasyona (0.4 - 1.7,
--    deadlift 1.5 referans) yeniden olceklendi.
-- 4. Yeni kategoriler: 'olympic' ve 'crossfit' (CHECK kisiti genisletildi).
--
-- Idempotent: ON CONFLICT ile tekrar calistirilabilir.
-- ============================================================

-- Kategori kisitini genislet (eski kurulumlarda mevcut kisit kaldirilir)
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_category_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check
    CHECK (category IN ('strength', 'running', 'hyrox', 'olympic', 'crossfit'));

INSERT INTO exercises (exercise_id, name, category, cns_load_factor, target_muscles) VALUES

-- ---------------------------------------------------------
-- 1. OLIMPIK KALDIRISLAR (maksimum patlayicilik, en yuksek CNS)
-- ---------------------------------------------------------
('snatch',           'Snatch',            'olympic', 1.7, '{"hamstrings": 0.6, "glutes": 0.6, "traps": 0.5, "front_delts": 0.5, "upper_back": 0.6, "core": 0.5, "quadriceps": 0.4}'),
('power_snatch',     'Power Snatch',      'olympic', 1.5, '{"hamstrings": 0.5, "glutes": 0.5, "traps": 0.5, "front_delts": 0.5, "upper_back": 0.5, "core": 0.4}'),
('clean_and_jerk',   'Clean & Jerk',      'olympic', 1.7, '{"quadriceps": 0.7, "glutes": 0.6, "front_delts": 0.6, "triceps": 0.5, "traps": 0.5, "core": 0.5}'),
('power_clean',      'Power Clean',       'olympic', 1.4, '{"quadriceps": 0.5, "hamstrings": 0.6, "glutes": 0.6, "traps": 0.6, "upper_back": 0.5, "core": 0.4}'),
('hang_clean',       'Hang Clean',        'olympic', 1.3, '{"hamstrings": 0.6, "glutes": 0.6, "traps": 0.5, "upper_back": 0.5, "core": 0.4}'),
('push_press',       'Push Press',        'olympic', 1.2, '{"front_delts": 1.0, "side_delts": 0.4, "triceps": 0.6, "quadriceps": 0.3, "core": 0.3}'),
('split_jerk',       'Split Jerk',        'olympic', 1.3, '{"front_delts": 0.9, "triceps": 0.7, "quadriceps": 0.5, "core": 0.4}'),
('overhead_squat',   'Overhead Squat',    'olympic', 1.5, '{"quadriceps": 0.9, "front_delts": 0.5, "core": 0.8, "upper_back": 0.5, "glutes": 0.5}'),

-- ---------------------------------------------------------
-- 2. CROSSFIT & JIMNASTIK (vucut agirligi + metabolik kondisyon)
-- ---------------------------------------------------------
('ring_muscle_up',      'Ring Muscle-Up',           'crossfit', 1.2, '{"lats": 0.8, "chest": 0.6, "triceps": 0.7, "core": 0.6, "front_delts": 0.4}'),
('bar_muscle_up',       'Bar Muscle-Up',            'crossfit', 1.1, '{"lats": 0.9, "chest": 0.5, "triceps": 0.6, "core": 0.5}'),
('handstand_push_up',   'Handstand Push-Up (HSPU)', 'crossfit', 1.1, '{"front_delts": 1.0, "side_delts": 0.4, "triceps": 0.8, "core": 0.4}'),
('kipping_pull_up',     'Kipping Pull-Up',          'crossfit', 0.8, '{"lats": 0.7, "core": 0.4, "biceps": 0.3}'),
('chest_to_bar_pull_up','Chest-to-Bar Pull-Up',     'crossfit', 0.9, '{"lats": 0.9, "biceps": 0.4, "core": 0.4}'),
('toes_to_bar',         'Toes-to-Bar (T2B)',        'crossfit', 0.9, '{"core": 1.0, "lats": 0.5, "forearms": 0.4}'),
('double_unders',       'Double Unders',            'crossfit', 0.7, '{"calves": 1.0, "forearms": 0.3, "core": 0.2}'),
('box_jump',            'Box Jump',                 'crossfit', 0.9, '{"quadriceps": 0.8, "calves": 0.6, "glutes": 0.6}'),
('thruster',            'Barbell Thruster',         'crossfit', 1.3, '{"quadriceps": 0.8, "front_delts": 0.8, "triceps": 0.5, "glutes": 0.5, "core": 0.5}'),
('kettlebell_swing',    'Kettlebell Swing',         'crossfit', 1.0, '{"hamstrings": 0.8, "glutes": 0.9, "lower_back": 0.6, "core": 0.4}'),
('burpee',              'Burpee',                   'crossfit', 1.0, '{"chest": 0.5, "quadriceps": 0.5, "core": 0.4, "triceps": 0.3}'),
('dumbbell_snatch',     'Dumbbell Snatch',          'crossfit', 1.1, '{"hamstrings": 0.5, "glutes": 0.5, "front_delts": 0.6, "traps": 0.4, "core": 0.4}'),
('devil_press',         'Devil Press',              'crossfit', 1.3, '{"chest": 0.5, "front_delts": 0.7, "quadriceps": 0.5, "glutes": 0.5, "core": 0.5}'),
('wall_walk',           'Wall Walk',                'crossfit', 1.0, '{"front_delts": 0.8, "core": 0.7, "triceps": 0.5, "chest": 0.4}'),
('assault_bike',        'Assault Bike',             'crossfit', 0.8, '{"quadriceps": 0.5, "hamstrings": 0.4, "calves": 0.3, "core": 0.3}'),

-- ---------------------------------------------------------
-- 3. KUVVET / HIPERTROFI (mevcut katalogda olmayanlar)
-- ---------------------------------------------------------
-- Gogus
('incline_db_press',  'Incline Dumbbell Press', 'strength', 0.9, '{"chest": 0.9, "front_delts": 0.6, "triceps": 0.5}'),
('weighted_dips',     'Weighted Dips',          'strength', 1.0, '{"chest": 0.8, "triceps": 0.9, "front_delts": 0.4}'),
('cable_crossover',   'Cable Crossover',        'strength', 0.5, '{"chest": 1.0}'),
('pec_deck',          'Pec Deck Machine',       'strength', 0.5, '{"chest": 1.0}'),

-- Sirt
('lat_pulldown',      'Lat Pulldown',           'strength', 0.7, '{"lats": 1.0, "biceps": 0.4}'),
('seated_cable_row',  'Seated Cable Row',       'strength', 0.7, '{"lats": 0.8, "upper_back": 0.7, "biceps": 0.4}'),
('back_extension',    'Back Extension',         'strength', 0.6, '{"lower_back": 1.0, "glutes": 0.5, "hamstrings": 0.4}'),

-- Bacak
('leg_press',         'Leg Press Machine',      'strength', 0.8, '{"quadriceps": 1.0, "glutes": 0.5}'),
('leg_extension',     'Leg Extension',          'strength', 0.5, '{"quadriceps": 1.0}'),
('leg_curl',          'Hamstring Leg Curl',     'strength', 0.5, '{"hamstrings": 1.0}'),
('calf_raise',        'Standing Calf Raise',    'strength', 0.5, '{"calves": 1.0}'),
('walking_lunge',     'Walking Lunge',          'strength', 0.9, '{"quadriceps": 1.0, "glutes": 0.8, "hamstrings": 0.3, "core": 0.3}'),
('goblet_squat',      'Goblet Squat',           'strength', 0.8, '{"quadriceps": 0.9, "glutes": 0.6, "core": 0.4}'),
('step_up',           'Weighted Step-Up',       'strength', 0.9, '{"quadriceps": 0.9, "glutes": 0.7, "core": 0.3}'),

-- Omuz & Kollar
('db_shoulder_press', 'Dumbbell Shoulder Press','strength', 0.8, '{"front_delts": 1.0, "side_delts": 0.5, "triceps": 0.5}'),
('lateral_raise',     'Dumbbell Lateral Raise', 'strength', 0.5, '{"side_delts": 1.0}'),
('face_pull',         'Cable Face Pull',        'strength', 0.5, '{"upper_back": 0.8, "side_delts": 0.5}'),
('barbell_curl',      'Barbell Bicep Curl',     'strength', 0.5, '{"biceps": 1.0}'),
('hammer_curl',       'Dumbbell Hammer Curl',   'strength', 0.5, '{"biceps": 0.8, "forearms": 0.6}'),
('tricep_pushdown',   'Cable Tricep Pushdown',  'strength', 0.5, '{"triceps": 1.0}'),
('skullcrusher',      'EZ-Bar Skullcrusher',    'strength', 0.5, '{"triceps": 1.0}'),

-- Core
('ab_wheel',          'Ab Wheel Rollout',       'strength', 0.7, '{"core": 1.0, "lats": 0.3}'),
('cable_crunch',      'Kneeling Cable Crunch',  'strength', 0.5, '{"core": 1.0}'),
('plank',             'Plank',                  'strength', 0.4, '{"core": 1.0}'),

-- ---------------------------------------------------------
-- 4. KOSU (mevcut 4 tipe ek)
-- ---------------------------------------------------------
('run_hills',         'Hill Repeats',           'running', 1.2, '{"quadriceps": 0.6, "glutes": 0.6, "calves": 0.8, "hamstrings": 0.5}')

ON CONFLICT (exercise_id) DO UPDATE SET
    name            = EXCLUDED.name,
    category        = EXCLUDED.category,
    cns_load_factor = EXCLUDED.cns_load_factor,
    target_muscles  = EXCLUDED.target_muscles;
