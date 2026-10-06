import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import socket from "./socket";

export default function Admin() {
  const [event, setEvent] = useState("");
  const [grade, setGrade] = useState("");
  const [maleStudents, setMaleStudents] = useState([]);
  const [femaleStudents, setFemaleStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const events = ["50m", "100m", "200m", "400m"];

  const gradeOptions =
    event === "50m" || event === "200m"
      ? ["G1", "G2", "G3", "G4", "G5"]
      : ["G6", "G7", "G8", "G9", "G10", "G11", "G12"];

  useEffect(() => {
    const fetchStudents = async () => {
      if (!event || !grade) {
        setMaleStudents([]);
        setFemaleStudents([]);
        return;
      }

      setStudentsLoading(true);
      setMaleStudents([]);
      setFemaleStudents([]);

      try {
        const { data: races, error: raceError } = await supabase
          .from("races")
          .select("race_id")
          .eq("race_event", event);

        if (raceError) throw raceError;

        const raceIds = races.map((r) => r.race_id);

        let alreadyInRaceIds = [];

        if (raceIds.length > 0) {
          const { data: raceResults, error: resultsError } = await supabase
            .from("race_results")
            .select("student_id")
            .in("race_id", raceIds);

          if (resultsError) throw resultsError;

          alreadyInRaceIds = raceResults.map((rr) => rr.student_id);
        }

        let queryMale = supabase
          .from("students")
          .select("*")
          .eq("grade", grade)
          .eq("sex", "Male");

        let queryFemale = supabase
          .from("students")
          .select("*")
          .eq("grade", grade)
          .eq("sex", "Female");

        if (alreadyInRaceIds.length > 0) {
          const excludedIds = `(${alreadyInRaceIds.join(",")})`;

          queryMale = queryMale.not(
            "student_id",
            "in",
            excludedIds
          );

          queryFemale = queryFemale.not(
            "student_id",
            "in",
            excludedIds
          );
        }

        const [
          { data: dataMale, error: errorMale },
          { data: dataFemale, error: errorFemale },
        ] = await Promise.all([queryMale, queryFemale]);

        if (errorMale) throw errorMale;
        if (errorFemale) throw errorFemale;

        setMaleStudents(dataMale || []);
        setFemaleStudents(dataFemale || []);
      } catch (error) {
        console.error("Error fetching students:", error);
        setMaleStudents([]);
        setFemaleStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    };

    fetchStudents();
  }, [event, grade]);

  const toggleSelect = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
    } else if (selected.length < 8) {
      setSelected([...selected, id]);
    }
  };

  const saveRace = () => {
    if (!event || !grade) {
      alert("Please complete all filters.");
      return;
    }

    if (selected.length === 0) {
      alert("Select at least one student.");
      return;
    }

    setLoading(true);

    socket.emit(
      "create-race",
      {
        event,
        grade,
        studentIds: selected,
      },
      (response) => {
        setLoading(false);

        if (!response?.success) {
          console.error(response?.message);
          alert(response?.message || "Error saving race or results.");
          return;
        }

        alert("Race and results saved!");

        setSelected([]);
        setMaleStudents([]);
        setFemaleStudents([]);
        setEvent("");
        setGrade("");
      }
    );
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
              setGrade("");
              setSelected([]);
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
          <select
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value);
              setSelected([]);
            }}
          >
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

        {!event || !grade ? (
          <p>Select an event and grade to view students.</p>
        ) : studentsLoading ? (
          <p>Loading students...</p>
        ) : (
          <div className="genders">
            <div>
              <h4>Male</h4>

              {maleStudents.length === 0 ? (
                <p>No students available.</p>
              ) : (
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
                        disabled={
                          !selected.includes(s.student_id) &&
                          selected.length >= 8
                        }
                      />

                      {s.first_name} {s.last_name} ({s.house})
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4>Female</h4>

              {femaleStudents.length === 0 ? (
                <p>No students available.</p>
              ) : (
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
                        disabled={
                          !selected.includes(s.student_id) &&
                          selected.length >= 8
                        }
                      />

                      {s.first_name} {s.last_name} ({s.house})
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={saveRace}
        disabled={loading || studentsLoading}
        className="save-race"
      >
        {loading
          ? "Saving..."
          : `Save Race (${selected.length})`}
      </button>
    </div>
  );
}