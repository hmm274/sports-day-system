import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Timer from './Timer';

const AdminManageTimer = ({handleStart, handleStop, handleSave, socket}) => {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [laneStudents, setLaneStudents] = useState([]); // array of student objects per lane
  const [timers, setTimers] = useState({});
  const [noResult, setNoResult] = useState({});

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
      <div style={{ marginBottom: '15px' }}>
        <button onClick={handleStart}>Start All</button>
        <button onClick={handleStop}>Stop All</button>
        <button onClick={()=>handleSave(selectedRaceId, timers, fetchRaces, fetchLaneStudents, noResult)}>Reset / Save</button>
      </div>
      <div>
        {[...Array(8)].map((_, i) => {
          const student = laneStudents[i];
          return (
            <div key={i}>
              <h4>
                Lane {i + 1}{' '}
                {student ? `- ${student.first_name} ${student.last_name} (${student.house})` : ''}
              </h4>

              {student && (
                <label>
                  <input
                    type="checkbox"
                    checked={!!noResult[i + 1]}
                    onChange={(e) =>
                      setNoResult((prev) => ({
                        ...prev,
                        [i + 1]: e.target.checked,
                      }))
                    }
                  />
                  No Result
                </label>
              )}

              <Timer
                laneId={i + 1}
                socket={socket}
                isAdmin={true}
                selectedRaceId={selectedRaceId}
                studentId={student?.student_id || null}
                onStop={(lane, time) => {
                  setTimers((prev) => ({ ...prev, [lane]: { studentId: student?.student_id, time } }));
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default AdminManageTimer;