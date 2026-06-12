-- ============================================================
-- 004: Seed Data - Egzersiz Katalogu
-- Temel kuvvet hareketleri + 8 resmi HYROX istasyonu + kosu.
-- cns_load_factor: sistemik sinirsel yuk katsayisi (deterministik motor girdisi).
-- target_muscles: kas grubu hacim katsayilari (haftalik set hesabi icin).
-- Idempotent: ON CONFLICT ile tekrar calistirilabilir.
-- ============================================================

INSERT INTO exercises (exercise_id, name, category, cns_load_factor, target_muscles) VALUES
-- ------------------------- STRENGTH -------------------------
('back_squat',        'Back Squat',          'strength', 1.4, '{"quadriceps": 1.0, "glutes": 0.8, "hamstrings": 0.4, "core": 0.3}'),
('front_squat',       'Front Squat',         'strength', 1.3, '{"quadriceps": 1.0, "glutes": 0.6, "core": 0.5}'),
('deadlift',          'Deadlift',            'strength', 1.5, '{"hamstrings": 1.0, "glutes": 0.9, "lower_back": 0.8, "traps": 0.4, "core": 0.4}'),
('romanian_deadlift', 'Romanian Deadlift',   'strength', 1.2, '{"hamstrings": 1.0, "glutes": 0.7, "lower_back": 0.5}'),
('bench_press',       'Bench Press',         'strength', 1.0, '{"chest": 1.0, "triceps": 0.5, "front_delts": 0.4}'),
('overhead_press',    'Overhead Press',      'strength', 1.0, '{"front_delts": 1.0, "side_delts": 0.5, "triceps": 0.5, "core": 0.3}'),
('barbell_row',       'Barbell Row',         'strength', 1.1, '{"lats": 1.0, "upper_back": 0.8, "biceps": 0.4, "lower_back": 0.3}'),
('pull_up',           'Pull Up',             'strength', 0.9, '{"lats": 1.0, "biceps": 0.6, "upper_back": 0.5}'),
('hip_thrust',        'Hip Thrust',          'strength', 0.9, '{"glutes": 1.0, "hamstrings": 0.4}'),
('bulgarian_split_squat', 'Bulgarian Split Squat', 'strength', 1.0, '{"quadriceps": 1.0, "glutes": 0.8, "hamstrings": 0.3}'),

-- ---------------------- HYROX STATIONS -----------------------
-- Not: Mesafe/tekrar isimde sabitlenmez; kullanici set girisinde
-- olcum tipini (tekrar/mesafe/sure) ve degerini kendisi belirler.
('ski_erg',           'SkiErg',            'hyrox', 0.8, '{"lats": 0.8, "triceps": 0.6, "core": 0.6, "upper_back": 0.5}'),
('sled_push',         'Sled Push',         'hyrox', 1.3, '{"quadriceps": 1.0, "glutes": 0.8, "calves": 0.5, "core": 0.4}'),
('sled_pull',         'Sled Pull',         'hyrox', 1.2, '{"lats": 0.9, "upper_back": 0.8, "biceps": 0.6, "hamstrings": 0.5}'),
('burpee_broad_jump', 'Burpee Broad Jump', 'hyrox', 1.1, '{"quadriceps": 0.8, "chest": 0.6, "glutes": 0.6, "core": 0.6}'),
('rowing',            'Rowing',            'hyrox', 0.8, '{"lats": 0.7, "quadriceps": 0.6, "upper_back": 0.6, "core": 0.4}'),
('farmers_carry',     'Farmers Carry',     'hyrox', 0.9, '{"traps": 0.9, "forearms": 0.9, "core": 0.7, "glutes": 0.3}'),
('sandbag_lunges',    'Sandbag Lunges',    'hyrox', 1.2, '{"quadriceps": 1.0, "glutes": 0.9, "hamstrings": 0.4, "core": 0.5}'),
('wall_balls',        'Wall Balls',        'hyrox', 1.0, '{"quadriceps": 0.8, "front_delts": 0.7, "glutes": 0.6, "core": 0.4}'),

-- -------------------------- RUNNING --------------------------
-- Not: 'running' icin avg_hr Zone 2 araliginda ise kural motoru
-- cns_load_factor degerini 0.5'e dusurur (Cardio Modifier).
('run_easy',          'Easy / Zone 2 Run',   'running', 0.7, '{"quadriceps": 0.4, "hamstrings": 0.4, "calves": 0.5, "glutes": 0.3}'),
('run_tempo',         'Tempo Run',           'running', 1.0, '{"quadriceps": 0.5, "hamstrings": 0.5, "calves": 0.6, "glutes": 0.4}'),
('run_intervals',     'Interval / Track Run','running', 1.3, '{"quadriceps": 0.6, "hamstrings": 0.6, "calves": 0.7, "glutes": 0.5}'),
('run_hyrox_pace',    'HYROX Race Pace Run', 'running', 1.1, '{"quadriceps": 0.5, "hamstrings": 0.5, "calves": 0.6, "glutes": 0.4}')

ON CONFLICT (exercise_id) DO UPDATE SET
    name            = EXCLUDED.name,
    category        = EXCLUDED.category,
    cns_load_factor = EXCLUDED.cns_load_factor,
    target_muscles  = EXCLUDED.target_muscles;
