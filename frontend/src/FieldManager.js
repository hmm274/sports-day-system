import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function FieldManager() {
  const [eventType, setEventType] = useState("");
  const [grade, setGrade] = useState("");
  const [gender, setGender] = useState("");
  const [fieldId, setFieldId] = useState(null);
  const [students, setStudents] = useState([]);
  const [distances, setDistances] = useState({});
  const [lockedInputs, setLockedInputs] = useState({});
  const [noResult, setNoResult] = useState({});

  useEffect(() => {
    const fetchFieldId = async () => {
      if (eventType && grade && gender) {
        const { data, error } = await supabase
          .from("field_events")
          .select("field_id")
          .eq("field_event", eventType)
          .eq("grade", grade)
          .eq("gender", gender)
          .single();

        if (error) {
          console.error(error);
        } else {
          setFieldId(data.field_id);
        }
      }
    };

    fetchFieldId();
  }, [eventType, grade, gender]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!fieldId) return;

      const { data: results, error: resultsError } = await supabase
        .from("field_results")
        .select("student_id, distance")
        .eq("field_id", fieldId);

      if (resultsError) {
        console.error(resultsError);
        return;
      }

      const resultsMap = {};
      results.forEach(r => {
        resultsMap[r.student_id] = r.distance;
      });

      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("student_id, first_name, last_name")
        .eq("grade", grade)
        .eq("sex", gender);

      if (studentsError) {
        console.error(studentsError);
        return;
      }

      setDistances(prev => ({
        ...prev,
        [fieldId]: { ...resultsMap, ...prev[fieldId] }
      }));

      setLockedInputs(prev => ({
        ...prev,
        [fieldId]: Object.fromEntries(
          Object.keys(resultsMap).map(id => [id, true])
        )
      }));

      const merged = studentsData.map(s => ({
        ...s,
        existingResult: resultsMap[s.student_id] ?? null,
      }));

      setStudents(merged);
    };

    fetchStudents();
  }, [fieldId, grade, gender]);

  const handleSetDistance = async (studentId) => {
    const no_result = noResult[fieldId]?.[studentId];
    let distance = null;

    if (!no_result){
      const rawValue = distances[fieldId]?.[studentId];
      distance = parseFloat(rawValue?.trim().replace(",", "."));
      if (isNaN(distance)) return alert("Enter a valid number");
    }

    const { error: insertError } = await supabase
        .from("field_results")
        .upsert([{ field_id: fieldId, student_id: studentId, distance: no_result ? null : distance, points: no_result ? 0 : null, no_result: no_result ? no_result : false }], {
        onConflict: ["field_id", "student_id"],
        });

    if (insertError) {
        console.error(insertError);
        return;
    }

    setLockedInputs(prev => ({
    ...prev,
    [fieldId]: { ...prev[fieldId], [studentId]: true }
    }));

    const { data: results, error: resultsError } = await supabase
        .from("field_results")
        .select("student_id, distance")
        .eq("field_id", fieldId);

    if (resultsError) {
        console.error(resultsError);
        return;
    }
    const validResults = results.filter(r => !(noResult[fieldId]?.[r.student_id]));
    const sorted = validResults.sort((a, b) => b.distance - a.distance);
    const pointsMap = {};
    sorted.forEach((r, index) => {
        if (index === 0) pointsMap[r.student_id] = 40;
        else if (index === 1) pointsMap[r.student_id] = 30;
        else if (index === 2) pointsMap[r.student_id] = 20;
        else if (index === 3) pointsMap[r.student_id] = 10;
        else pointsMap[r.student_id] = 5;
    });

    for (const sId in pointsMap) {
        const { error: updateError } = await supabase
        .from("field_results")
        .update({ points: pointsMap[sId] })
        .eq("field_id", fieldId)
        .eq("student_id", sId);

        if (updateError) console.error(updateError);
    }
    };


  const handleEventType = (target) => {
    setEventType(target);
    setDistances(prev => ({ ...prev, [fieldId]: {} }));
  };

  return (
    <div>
      <h2>Field Event Entry</h2>
      <select
        value={eventType}
        onChange={(e) => handleEventType(e.target.value)}
      >
        <option value="">Select Event</option>
        <option value="Shotput">Shot Put</option>
        <option value="Long Jump">Long Jump</option>
      </select>

      <select
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
      >
        <option value="">Select Grade</option>
        {["G1","G2","G3","G4","G5","G6","G7","G8","G9","G10","G11","G12"].map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      <select
        value={gender}
        onChange={(e) => setGender(e.target.value)}
      >
        <option value="">Select Gender</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>

      {students.length > 0 && (
        <div>
          <h3>Enter Distances</h3>
          <div className="entries">
            {students.map((student) => (
              <div key={student.student_id}>
                <span>{student.first_name} {student.last_name}</span>
                <input
                  type="number"
                  step="0.01"
                  value={distances[fieldId]?.[student.student_id] || ""}
                  readOnly={lockedInputs[fieldId]?.[student.student_id] || noResult[fieldId]?.[student.studentId]}
                  onChange={(e) =>
                    setDistances({
                      ...distances,
                      [fieldId]: { ...distances[fieldId], [student.student_id]: e.target.value }
                    })
                  }
                />
                <label>
                  <input
                    type="checkbox"
                    checked={noResult[fieldId]?.[student.student_id] || false}
                    disabled={lockedInputs[fieldId]?.[student.student_id]}
                    onChange={(e) =>
                      setNoResult(prev => ({
                        ...prev,
                        [fieldId]: { ...prev[fieldId], [student.student_id]: e.target.checked }
                      }))
                    }
                  />{" "}
                  No Result
                </label>
                {!lockedInputs[fieldId]?.[student.student_id] && (
                  <button onClick={() => handleSetDistance(student.student_id)}>
                    Set
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}