-- Student Record System: Sample Seed Data
-- Demo password for all accounts: Test@1234
-- Passwords are stored as bcrypt hashes.

BEGIN;

-- 1. Users
INSERT INTO users (id, username, password_hash, role)
VALUES
(1, 'admin',    '$2b$10$WKaAJmmNs9QzvyCfG72Nc.kGMbACcUsliSkPfDhpOtoiL5FcSR//O', 'Admin'),
(2, 'faculty1', '$2b$10$WKaAJmmNs9QzvyCfG72Nc.kGMbACcUsliSkPfDhpOtoiL5FcSR//O', 'Faculty'),
(3, 'faculty2', '$2b$10$WKaAJmmNs9QzvyCfG72Nc.kGMbACcUsliSkPfDhpOtoiL5FcSR//O', 'Faculty'),
(4, 'student1', '$2b$10$WKaAJmmNs9QzvyCfG72Nc.kGMbACcUsliSkPfDhpOtoiL5FcSR//O', 'Student'),
(5, 'student2', '$2b$10$WKaAJmmNs9QzvyCfG72Nc.kGMbACcUsliSkPfDhpOtoiL5FcSR//O', 'Student'),
(6, 'student3', '$2b$10$WKaAJmmNs9QzvyCfG72Nc.kGMbACcUsliSkPfDhpOtoiL5FcSR//O', 'Student'),
(7, 'student4', '$2b$10$WKaAJmmNs9QzvyCfG72Nc.kGMbACcUsliSkPfDhpOtoiL5FcSR//O', 'Student'),
(8, 'student5', '$2b$10$WKaAJmmNs9QzvyCfG72Nc.kGMbACcUsliSkPfDhpOtoiL5FcSR//O', 'Student'),
(9, 'parent1',  '$2b$10$WKaAJmmNs9QzvyCfG72Nc.kGMbACcUsliSkPfDhpOtoiL5FcSR//O', 'Parent');

-- 2. Students
INSERT INTO students
(id, user_id, roll_no, name, dob, department, semester, guardian_contact)
VALUES
(1, 4, 'SR001', 'Aarav Sharma', '2005-02-14', 'CSE', 3, '9000000001'),
(2, 5, 'SR002', 'Diya Rao', '2005-06-22', 'CSE', 3, '9000000002'),
(3, 6, 'SR003', 'Ishaan Kumar', '2004-11-09', 'CSE', 3, '9000000003'),
(4, 7, 'SR004', 'Meera Nair', '2005-01-17', 'CSE', 3, '9000000004'),
(5, 8, 'SR005', 'Rohan Das', '2005-08-30', 'CSE', 3, '9000000005');

-- 3. Faculty
INSERT INTO faculty (id, user_id, name, department)
VALUES
(1, 2, 'Dr. Kavya Rao', 'CSE'),
(2, 3, 'Prof. Arjun Nair', 'CSE');

-- 4. Courses
INSERT INTO courses (id, code, name, semester, faculty_id)
VALUES
(1, 'CS301', 'Database Management Systems', 3, 1),
(2, 'CS302', 'Software Engineering', 3, 2),
(3, 'CS303', 'Machine Learning', 3, 1);

-- 5. Enrolments: each student is enrolled in all three courses
INSERT INTO enrolments (id, student_id, course_id)
SELECT
    (s.id - 1) * 3 + c.id,
    s.id,
    c.id
FROM students s
CROSS JOIN courses c;

-- 6. Parent linked to the first student
INSERT INTO parent_links (id, parent_user_id, student_id)
VALUES (1, 9, 1);

-- 7. Synchronise identity sequences with inserted IDs
SELECT setval(pg_get_serial_sequence('users', 'id'),
              (SELECT MAX(id) FROM users));

SELECT setval(pg_get_serial_sequence('students', 'id'),
              (SELECT MAX(id) FROM students));

SELECT setval(pg_get_serial_sequence('faculty', 'id'),
              (SELECT MAX(id) FROM faculty));

SELECT setval(pg_get_serial_sequence('courses', 'id'),
              (SELECT MAX(id) FROM courses));

SELECT setval(pg_get_serial_sequence('enrolments', 'id'),
              (SELECT MAX(id) FROM enrolments));

SELECT setval(pg_get_serial_sequence('parent_links', 'id'),
              (SELECT MAX(id) FROM parent_links));

COMMIT;