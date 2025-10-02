import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Timer from './Timer';

const AdminManageTimer = ({handleStart, handleStop, handleSave, socket}) => {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [laneStudents, setLaneStudents] = useState([]); // array of student objects per lane
  const [timers, setTimers] = useState({});
  const [noResult, setNoResult] = useState({});
  const [raceStatus, setRaceStatus] = useState("idle"); 
  // "idle" | "running" | "finished"
  const [activeTimers, setActiveTimers] = useState(0);

  const onStartAll = () => {
    handleStart();
    setRaceStatus("running");
    setActiveTimers(laneStudents.filter(Boolean).length); // number of students in race
  };

  const onStopAll = () => {
    handleStop(); // stops all timers in TimerGroup
    setActiveTimers(0);        // no timers left running
    setRaceStatus("finished"); // mark race as complete
  };

  const onReset = async() => {
    handleStop();
    await handleSave(selectedRaceId, timers, fetchRaces, fetchLaneStudents, noResult); 

    // clear all recorded times
    setTimers({});

    // reset active timers count
    setActiveTimers(0);

    // set race back to idle state
    setRaceStatus("idle");
    setSelectedRaceId(null);

    socket.emit("clear-students");
  };

  const fetchRaces = async () => {
    const { data: raceData, error: raceError } = await supabase
      .from('races')
      .select('*')
      .order('race_id', { ascending: true });

    if (raceError) {
      console.error('Error fetching races:', raceError);
      return;
    }

    // Fetch students for each race to display in dropdown
    const racesWithNames = await Promise.all(
      raceData.map(async (race) => {
        const { data: resultsData } = await supabase
          .from('race_results')
          .select(`
            student:student_id (
              first_name
            )
          `)
          .is('time',null)
          .eq('race_id', race.race_id);

        const names = resultsData?.map((r) => r.student.first_name).join(', ') || '';
        return { ...race, studentNames: names };
      })
    );

    setRaces(racesWithNames.filter(r => r.studentNames !== ''));
  };

  // Fetch all races along with student names for dropdown display
  useEffect(() => {
    fetchRaces();
  }, []);

  // Fetch lane students whenever a race is selected
  const fetchLaneStudents = async () => {
    if (!selectedRaceId) {
      setLaneStudents([]);
      return;
    }

    const { data, error } = await supabase
      .from('race_results')
      .select(`
        lane,
        student:student_id (
          student_id,
          first_name,
          last_name,
          house
        )
      `)
      .eq('race_id', selectedRaceId)
      .is('time',null)
      .order('lane', { ascending: true });

    if (error) {
      console.error('Error fetching lane students:', error);
      setLaneStudents([]);
    } else {
      const lanes = Array(8).fill(null);
      data.forEach((entry) => {
        lanes[entry.lane - 1] = entry.student;
      });
      setLaneStudents(lanes);
      socket.emit("assign-students", lanes); 
    }
  };

  useEffect(() => {
    fetchLaneStudents();
  }, [selectedRaceId]);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Manage Timers</h2>
      <div style={{ marginBottom: '15px' }}>
        <label>Select Race: </label>
        <select
          value={selectedRaceId || ''}
          onChange={(e) => setSelectedRaceId(e.target.value)}
        >
          <option value="">-- Select Race --</option>
          {races.map((race) => (
            <option key={race.race_id} value={race.race_id}>
              {race.race_event} ({race.studentNames})
            </option>
          ))}
        </select>
      </div>
      <div className="timer-options">
        <button onClick={onStartAll} disabled={!selectedRaceId || raceStatus!=="idle"}>Start All</button>
        <button onClick={onStopAll} disabled={!selectedRaceId || raceStatus!=="running"}>Stop All</button>
        <button onClick={onReset} disabled={!selectedRaceId || raceStatus==="running" || raceStatus==="idle"}>Reset / Save</button>
      </div>
      <div className="timers">
        {[...Array(8)].map((_, i) => {
          const student = laneStudents[i];
          const laneId = i + 1;
          const laneTimer = timers[laneId]; // get stored result for lane

          return (
            <div key={i} style={{ marginBottom: "20px" }}>
              {student && (
                <label>
                  <input
                    type="checkbox"
                    checked={!!noResult[laneId]}
                    onChange={(e) =>
                      setNoResult((prev) => ({
                        ...prev,
                        [laneId]: e.target.checked,
                      }))
                    }
                  />
                  No Result
                </label>
              )}

              <Timer
                laneId={laneId}
                socket={socket}
                isAdmin={true}
                selectedRaceId={(selectedRaceId==null) ? null : selectedRaceId}
                studentId={student?.student_id || null}
                studentName={student?.first_name || null}
                studentHouse={student?.house || null}
                onStop={(lane, time) => {
                  setTimers((prev) => ({
                    ...prev,
                    [lane]: { studentId: student?.student_id, time },
                  }));

                  // decrement active timers
                  setActiveTimers((prev) => {
                    const newCount = prev - 1;
                    if (newCount <= 0) {
                      setRaceStatus("finished");
                      return 0;
                    }
                    return newCount;
                  });
                }}
              />

              {/* ✅ Show saved/edited time if available */}
              {(laneTimer && !(selectedRaceId == null)) && (
                <p style={{ fontWeight: "bold", marginTop: "5px" }}>
                  Saved Time: {laneTimer.time.toFixed(3)}s
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default AdminManageTimer;