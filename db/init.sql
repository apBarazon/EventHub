CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  event_date DATETIME NOT NULL,
  location VARCHAR(120) NOT NULL DEFAULT 'School Campus',
  image_url VARCHAR(500) NOT NULL,
  max_participants INT NOT NULL DEFAULT 50,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  student_id VARCHAR(30) NOT NULL,
  course_year VARCHAR(50) NOT NULL,
  contact VARCHAR(30) NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reject_reason VARCHAR(200) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  UNIQUE KEY uq_user_event (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO events (title, description, event_date, location, image_url, max_participants) VALUES
('Annual Tech Conference', 'A full-day conference with student and industry speakers on software, AI, and cybersecurity.', '2026-11-12 09:00:00', 'Main Auditorium', 'https://picsum.photos/seed/conference/640/360', 150),
('Career Guidance Seminar', 'Learn resume writing, interview skills, and internship tips from alumni and HR professionals.', '2026-11-19 13:30:00', 'Room 301', 'https://picsum.photos/seed/seminar/640/360', 60),
('Hands-on Web Dev Workshop', 'Build a small website from scratch using HTML, CSS, and JavaScript. Bring your laptop.', '2026-11-26 10:00:00', 'Computer Lab 2', 'https://picsum.photos/seed/workshop/640/360', 30),
('Intramurals Opening Ceremony', 'Kick off the school sports season with parades, performances, and the opening games.', '2026-12-03 08:00:00', 'School Gymnasium', 'https://picsum.photos/seed/sports/640/360', 200),
('Christmas Talent Night', 'An evening of singing, dancing, and performances by students and faculty.', '2026-12-15 18:00:00', 'Open Quadrangle', 'https://picsum.photos/seed/talent/640/360', 120);
