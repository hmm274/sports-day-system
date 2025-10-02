import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function Admin() {
  const [event, setEvent] = useState("");
  const [grade, setGrade] = useState("");
  const [maleStudents, setMaleStudents] = useState([]);
  const [femaleStudents, setFemaleStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const events = ["50m", "100m", "200m", "400m"];
  //const gradeOptions = (event === "50m" || event === "200m") ? ["G1", "G2", "G3", "G4", "G5"] : ["G6", "G7", "G8", "G9", "G10", "G11", "G12"];
  const gradeOptions = ["G7"];
  // Fetch students whenever filters change
  useEffect(() => {
    const fetchStudents = async () => {
        if (!event || !grade) return;

        // 1. Find all races of this event
        const { data: races, error: raceError } = await supabase
            .from("races")
            .select("race_id")
            .eq("race_event", event);

        if (raceError) {
            console.error(raceError);
            return;
        }

        const raceIds = races.map(r => r.race_id);

        // 2. Get all students already in those races
        let alreadyInRaceIds = [];
        if (raceIds.length > 0) {
            const { data: raceResults, error: resultsError } = await supabase
            .from("race_results")
            .select("student_id")
            .in("race_id", raceIds);

            if (resultsError) {
            console.error(resultsError);
            return;
            }

            alreadyInRaceIds = raceResults.map(rr => rr.student_id);
        }

        // 3. Query students, excluding those already in race
        let queryMale = supabase
            .from("students")
            .select("*")
            .eq("grade", grade)
            .eq("sex", "Male");

        let queryFemale = supabase
            .from("students")
            .select("*")
            .eq("grade",grade)
            .eq("sex", "Female")

        if (alreadyInRaceIds.length > 0) {
            queryMale = queryMale.not("student_id", "in", `(${alreadyInRaceIds.join(",")})`);
            queryFemale = queryFemale.not("student_id", "in", `(${alreadyInRaceIds.join(",")})`);
        }

        const { data:dataMale, error:errorMale } = await queryMale;
        const { data:dataFemale, error:errorFemale } = await queryFemale;

        if (errorMale || errorFemale) {
            console.error(errorMale);
            console.error(errorFemale);
        } else {
            setMaleStudents(dataMale || []);
            setFemaleStudents(dataFemale || []);
        }
        };

    fetchStudents();
    }, [event, grade]);

  const toggleSelect = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
    } else {
      if (selected.length < 8) {
        setSelected([...selected, id]);
      }
    }
  };

  const saveRace = async () => {
    if (!event || !grade) {
        alert("Please complete all filters.");
        return;
    }

    if (selected.length === 0) {
        alert("Select at least one student.");
        return;
    }

    setLoading(true);

    try {
        // 1. Insert new race
        const { data: raceData, error: raceError } = await supabase
        .from("races")
        .insert([
            {
            race_event: event,
            },
        ])
        .select(); // select() ensures we get the inserted row including race_id

        if (raceError) throw raceError;

        const race_id = raceData[0].race_id;

        // 2. Insert each student into race_results
        const results = selected.map((student_id, idx) => ({
        race_id,
        student_id,
        lane: idx + 1,
        time: null, // initial time is null
        }));

        const { error: resultsError } = await supabase
        .from("race_results")
        .insert(results);

        if (resultsError) throw resultsError;

        alert("Race and results saved!");
        // Reset state
        setSelected([]);
        setMaleStudents([]);
        setFemaleStudents([]);
        setEvent("");
        setGrade("");
    } catch (err) {
        console.error(err);
        alert("Error saving race or results.");
    }

    setLoading(false);
    };

  return (
    <div>
      <h2>Setup New Race</h2>
      <div className="options">
        <div>
          <select
            value={event}
            onChange={(e) => {
              setEvent(e.target.value);
            }}
          >
            <option value="">Select event</option>
            {events.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Select grade</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <h3>Available Students</h3>
        <div className="genders">
          <div>
            <h4>Male</h4>
            {maleStudents.length === 0 && <p>No students available.</p>}
            <div style={{ maxHeight: "52vh", overflowY: "auto" }}>
              {maleStudents.map((s) => (
                <label
                  key={s.student_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px",
                    border: "1px solid #ccc",
                    marginBottom: "2px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s.student_id)}
                    onChange={() => toggleSelect(s.student_id)}
                    disabled={!selected.includes(s.student_id) && selected.length >= 8}
                  />
                  {s.first_name} {s.last_name} ({s.house})
                </label>
              ))}
            </div>
          </div>
          <div>
            <h4>Female</h4>
            {femaleStudents.length === 0 && <p>No students available.</p>}
            <div style={{ maxHeight: "52vh", overflowY: "auto" }}>
              {femaleStudents.map((s) => (
                <label
                  key={s.student_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px",
                    border: "1px solid #ccc",
                    marginBottom: "2px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s.student_id)}
                    onChange={() => toggleSelect(s.student_id)}
                    disabled={!selected.includes(s.student_id) && selected.length >= 8}
                  />
                  {s.first_name} {s.last_name} ({s.house})
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      <button onClick={saveRace} disabled={loading} className="save-race">
        {loading ? "Saving..." : "Save Race ("+selected.length+")"}
      </button>
    </div>
  );
}