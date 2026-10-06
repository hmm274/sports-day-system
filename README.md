# Sports Day Timing & Analytics System

A full-stack distributed sports timing and event management system designed to synchronize race timing across up to **8 independently operated lane devices** while centrally managing participants, results, field events, and house points.

The system was developed for a school Sports Day involving approximately **400 participants**, with the goal of replacing independent stopwatches and manual result consolidation with synchronized multi-device timing and centralized event management.

The application was tested and prepared for deployment, but limitations in the venue's network infrastructure prevented the multi-device system from being used during the final event.

## Features

### Server-Authoritative Multi-Device Timing

The core of the system is a distributed timing workflow connecting an administrator device with up to **8 independent lane devices**.

- The backend establishes a single authoritative timestamp when a race starts
- The race start is broadcast to all connected lane devices using **Socket.IO**
- Each lane official independently records their participant's finish
- Official elapsed times are calculated by the backend against the shared server-side start timestamp
- Individual lane results are returned to the administrator in real time
- Administrators can centrally start, stop, reset, and manage the complete race
- Each lane is associated with its assigned participant and race

When the administrator starts a race, the server records the race's start time and broadcasts the start event to the connected lane devices.

Each lane official can then independently record their participant's finish. The backend calculates the official elapsed time using the original server-side start timestamp, meaning all recorded lane times are measured against the same server clock rather than independently started browser timers.

### Race Management

- Create races by event and grade
- Assign up to 8 students to lanes
- Prevent duplicate student entries within the same event
- Track race times and no-results
- Automatically calculate points based on finishing position

### Field Event Management

- Manage field events by event, grade, and gender
- Record participant distances and no-results
- Automatically rank competitors and recalculate points
- Restore previously entered results when returning to an event

### House Points

- Aggregates points from both race and field events
- Displays totals for four houses:
  - Suzaku
  - Seiryuu
  - Genbu
  - Byakko
- Updates results through Supabase Realtime subscriptions

### Role-Based Event Operation

The system provides separate operational roles for:

- Administrator
- Lane 1–8 officials

Role passcodes are validated by the backend and configured using environment variables. Active roles are locked so that multiple devices cannot simultaneously take control of the same lane.

## Tech Stack

### Frontend

- React
- JavaScript
- Socket.IO Client
- Supabase JavaScript Client
- CSS

### Backend

- Node.js
- Express
- Socket.IO
- Supabase
- dotenv
- CORS

### Database

- PostgreSQL through Supabase
- Row Level Security (RLS)
- Supabase Realtime

## Architecture

The application combines real-time Socket.IO communication with Supabase-backed persistent storage.

```text
                     ┌──────────────────────┐
                     │    React Frontend    │
                     │                      │
                     │ Admin + Lane Clients │
                     └──────────┬───────────┘
                                │
                    Socket.IO   │   Read-only queries
                                │
               ┌────────────────┴───────────────┐
               │                                │
               ▼                                ▼
      ┌─────────────────┐              ┌─────────────────┐
      │ Express /       │              │    Supabase     │
      │ Socket.IO       │              │                 │
      │ Backend         │              │ PostgreSQL +    │
      └────────┬────────┘              │ Realtime + RLS  │
               │                       └─────────────────┘
               │
               │ Privileged writes
               │ using service role
               └──────────────────────────────►
```

The React clients communicate with the backend through Socket.IO for synchronized race operations.

The frontend uses the Supabase anonymous key for permitted read operations. Privileged database operations, including race creation and result submission, are performed through the backend using the Supabase service-role key.

The service-role key is never exposed to the frontend.

## Synchronized Timer Workflow

A race consists of multiple independently operated devices participating in the same shared timing session.

1. The administrator selects a race and loads its assigned participants.
2. Participant assignments are distributed to the connected lane devices.
3. The administrator starts the race.
4. The backend records a single authoritative start timestamp.
5. A start event is broadcast to all connected lane devices through Socket.IO.
6. Each lane device displays a running timer for its assigned participant.
7. When a participant finishes, the corresponding lane official stops their timer.
8. The backend calculates that lane's official elapsed time against the original server-side start timestamp.
9. The authoritative result is returned to the connected clients and displayed by the administrator.
10. Once the race is complete, the administrator reviews and submits the results.
11. The backend validates and stores the results in Supabase.
12. Finishing positions and house points are calculated from the submitted results.

This architecture separates the **shared race start** from the **independent lane finishes** while ensuring that official results are calculated against the same server-side clock.

## How to Use

### 1. Administrator Login

Open the application and select the administrator role.

Enter the administrator passcode configured on the backend.

The administrator interface provides access to:

- Race creation
- Race timing and lane management
- Field events
- Race results
- House points

### 2. Create a Race

From the race management interface:

1. Select the event.
2. Select the grade.
3. Choose the participating students.
4. Assign participants to the available lanes.
5. Save the race.

The race can then be selected from the timing interface.

### 3. Connect Lane Devices

Each lane official opens the application on a separate device and selects their assigned role:

```text
Lane 1
Lane 2
Lane 3
...
Lane 8
```

The official enters the corresponding lane passcode.

Once authenticated, the device becomes the timer for that lane.

### 4. Load the Race

On the administrator timing interface, select the race that is about to begin.

The system loads the participants assigned to each lane and distributes those assignments to the connected lane devices.

### 5. Start the Race

The administrator starts the race.

The backend records the authoritative start timestamp and broadcasts the race start to the connected lane devices.

### 6. Record Finishes

As each participant crosses the finish line, the official responsible for that lane stops their timer.

Each lane can finish independently while remaining tied to the same server-side race start.

The backend calculates the official elapsed time and returns it to the connected clients.

### 7. Save Results

After the race is complete, the administrator reviews and saves the results.

The backend:

1. Validates the submitted results.
2. Stores the results in Supabase.
3. Determines finishing positions.
4. Assigns points.
5. Updates the data used by the house-points display.

### 8. Record Field Events

The administrator can also open the field-event interface and select an event, grade, and gender.

Results can then be entered for individual students. The backend recalculates rankings and points as results are submitted.

### 9. View House Points

The House Points interface combines points earned from race and field events.

Updates to the underlying results are reflected through Supabase Realtime.

## Scoring

Race and field-event placements use the following point system:

| Place | Points |
|------:|-------:|
| 1st | 40 |
| 2nd | 30 |
| 3rd | 20 |
| 4th | 10 |
| 5th | 5 |
| 6th+ | 0 |

Point calculations are performed by the backend rather than trusted to the client.

## Security

The system separates public/read-only functionality from privileged operations.

- Role passcodes are stored as backend environment variables
- Passcodes are validated server-side
- Administrative Socket.IO events verify the connected user's role
- Lane-specific operations verify lane authorization
- Active roles are protected from simultaneous use by multiple clients
- Supabase Row Level Security restricts anonymous database access
- The frontend does not directly perform privileged database writes
- The Supabase service-role key exists only on the backend
- Environment files are excluded from Git

## Project Structure

```text
sports-day-system/
├── backend/
│   ├── server.js
│   ├── supabaseClient.js
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── Admin.js
│   │   ├── AdminManageTimer.js
│   │   ├── App.js
│   │   ├── FieldManager.js
│   │   ├── HousePoints.js
│   │   ├── Races.js
│   │   ├── Timer.js
│   │   ├── socket.js
│   │   └── supabaseClient.js
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

## Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/hmm274/sports-day-system.git
cd sports-day-system
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

Create a `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

ADMIN_PASSCODE=your_admin_passcode
LANE_1_PASSCODE=your_lane_1_passcode
LANE_2_PASSCODE=your_lane_2_passcode
LANE_3_PASSCODE=your_lane_3_passcode
LANE_4_PASSCODE=your_lane_4_passcode
LANE_5_PASSCODE=your_lane_5_passcode
LANE_6_PASSCODE=your_lane_6_passcode
LANE_7_PASSCODE=your_lane_7_passcode
LANE_8_PASSCODE=your_lane_8_passcode

CLIENT_URL=http://localhost:3000
```

Start the backend:

```bash
npm start
```

The local backend defaults to:

```text
http://localhost:3001
```

### 3. Install Frontend Dependencies

In another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
REACT_APP_BACKEND_URL=http://localhost:3001
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the frontend:

```bash
npm start
```

The application will run locally at:

```text
http://localhost:3000
```

## Environment Variables

### Backend

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged database access |
| `ADMIN_PASSCODE` | Administrator authentication |
| `LANE_1_PASSCODE` – `LANE_8_PASSCODE` | Lane official authentication |
| `CLIENT_URL` | Allowed frontend origin for CORS |
| `PORT` | Server port; defaults to `3001` locally |

### Frontend

| Variable | Purpose |
|---|---|
| `REACT_APP_BACKEND_URL` | Socket.IO backend URL |
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Public Supabase anonymous key |

> Never expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend.

## Background

This project began as a solution to the logistical challenges of running a school Sports Day across multiple races, lanes, officials, and field events.

Traditional timing would require officials to operate independent stopwatches and manually consolidate the results afterward. The system instead uses a distributed approach in which separate lane devices participate in the same race while the backend maintains the authoritative timing state and event data is managed centrally.

The system was designed for a Sports Day involving approximately **400 participants** and was tested and prepared for deployment. However, limitations in the venue's network infrastructure prevented the multi-device system from being used during the final event.

This exposed an important constraint of the original architecture: real-time event software operating at temporary venues cannot always assume reliable Internet connectivity.

## Future Improvements

Potential improvements include:

- **Offline and local-network operation** to reduce dependence on venue Internet connectivity
- **More robust state handling during active processes**, including race starts, timer operation, result submission, reconnection, interrupted requests, and accidental refreshes
- **Custom event creation**, allowing administrators to create additional race and field-event types and configure eligibility and scoring rules through the application
- **Integrated student data management**, allowing administrators to add, edit, or bulk-upload participant information through the application instead of directly modifying Supabase
- Automated test coverage for timing, scoring, authorization, and result submission
- More granular authentication and session management
- Improved responsive/mobile UI
- Historical event analytics
- Exportable results and reports
- Race scheduling and event sequencing
- Improved connection-status and error feedback