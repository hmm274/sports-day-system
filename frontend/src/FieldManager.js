import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient"; // adjust import path

export default function FieldManager() {
  const [eventType, setEventType] = useState("");
  const [grade, setGrade] = useState("");
  const [gender, setGender] = useState("");
  const [fieldId, setFieldId] = useState(null);
  const [students, setStudents] = useState([]);
  const [distances, setDistances] = useState({}); // { [fieldId]: { [studentId]: value } }
  const [lockedInputs, setLockedInputs] = useState({}); // { [fieldId]: { [studentId]: true } }

  // Fetch field_id whenever event, grade, and gender are selected
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

  // Fetch students and existing results for the current field
  useEffect(() => {
    const fetchStudents = async () => {
      if (!fieldId) return;

      // 1. Get all results for this field
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

      // 2. Get all students in grade/gender
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("student_id, first_name, last_name")
        .eq("grade", grade)
        .eq("sex", gender);

      if (studentsError) {
        console.error(studentsError);
        return;
      }

      // 3. Initialize distances and lockedInputs for this field
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

      // 4. Merge students with results
      const merged = studentsData.map(s => ({
        ...s,
        existingResult: resultsMap[s.student_id] ?? null,
      }));

      setStudents(merged);
    };

    fetchStudents();
  }, [fieldId, grade, gender]);

  const handleSetDistance = async (studentId) => {
    const rawValue = distances[fieldId]?.[studentId];
    const distance = parseFloat(rawValue?.trim().replace(",", "."));
    if (isNaN(distance)) return alert("Enter a valid number");

    // 1. Insert or update the field result
    const { error: insertError } = await supabase
        .from("field_results")
        .upsert([{ field_id: fieldId, student_id: studentId, distance }], {
        onConflict: ["field_id", "student_id"],
        });

    if (insertError) {
        console.error(insertError);
        return;
    }

    // 2. Lock the input
    setLockedInputs(prev => ({
    ...prev,
    [fieldId]: { ...prev[fieldId], [studentId]: true }
    }));


    // 3. Fetch all results for this field
    const { data: results, error: resultsError } = await supabase
        .from("field_results")
        .select("student_id, distance")
        .eq("field_id", fieldId);

    if (resultsError) {
        console.error(resultsError);
        return;
    }

    // 4. Sort descending by distance
    const sorted = results.sort((a, b) => b.distance - a.distance);

    // 5. Assign points based on rank
    const pointsMap = {};
    sorted.forEach((r, index) => {
        if (index === 0) pointsMap[r.student_id] = 40;
        else if (index === 1) pointsMap[r.student_id] = 30;
        else if (index === 2) pointsMap[r.student_id] = 20;
        else if (index === 3) pointsMap[r.student_id] = 10;
        else pointsMap[r.student_id] = 5;
    });

    // 6. Update points in field_results table
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
    // Clear only the current field's typed distances, keep others
    setDistances(prev => ({ ...prev, [fieldId]: {} }));
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Field Event Entry</h2>

      <select
        className="border p-2 mr-2"
        value={eventType}
        onChange={(e) => handleEventType(e.target.value)}
      >
        <option value="">Select Event</option>
        <option value="Shotput">Shot Put</option>
        <option value="Long Jump">Long Jump</option>
      </select>

      <select
        className="border p-2 mr-2"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
      >
        <option value="">Select Grade</option>
        {["G1","G2","G3","G4","G5","G6","G7","G8","G9","G10","G11","G12"].map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      <select
        className="border p-2"
        value={gender}
        onChange={(e) => setGender(e.target.value)}
      >
        <option value="">Select Gender</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>

      {students.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Enter Distances</h3>
          {students.map((student) => (
            <div key={student.student_id} className="flex items-center mb-2">
              <span className="w-40">
                {student.first_name} {student.last_name}
              </span>
              <input
                type="number"
                step="0.01"
                className="border p-1 mr-2"
                value={distances[fieldId]?.[student.student_id] || ""}
                readOnly={lockedInputs[fieldId]?.[student.student_id]}
                onChange={(e) =>
                  setDistances({
                    ...distances,
                    [fieldId]: { ...distances[fieldId], [student.student_id]: e.target.value }
                  })
                }
              />
              {!lockedInputs[fieldId]?.[student.student_id] && (
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                  onClick={() => handleSetDistance(student.student_id)}
                >
                  Set
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}