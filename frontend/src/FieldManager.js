import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import socket from "./socket";

export default function FieldManager() {
  const [eventType, setEventType] = useState("");
  const [grade, setGrade] = useState("");
  const [gender, setGender] = useState("");
  const [fieldId, setFieldId] = useState(null);

  const [students, setStudents] = useState([]);
  const [distances, setDistances] = useState({});
  const [lockedInputs, setLockedInputs] = useState({});
  const [noResult, setNoResult] = useState({});

  const [eventLoading, setEventLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [savingStudents, setSavingStudents] = useState({});

  useEffect(() => {
    const fetchFieldId = async () => {
      if (!eventType || !grade || !gender) {
        setFieldId(null);
        setStudents([]);
        return;
      }

      setEventLoading(true);
      setFieldId(null);
      setStudents([]);

      try {
        const { data, error } = await supabase
          .from("field_events")
          .select("field_id")
          .eq("field_event", eventType)
          .eq("grade", grade)
          .eq("gender", gender)
          .single();

        if (error) throw error;

        setFieldId(data.field_id);
      } catch (error) {
        console.error("Error loading field event:", error);
        setFieldId(null);
      } finally {
        setEventLoading(false);
      }
    };

    fetchFieldId();
  }, [eventType, grade, gender]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!fieldId) {
        setStudents([]);
        return;
      }

      setStudentsLoading(true);
      setStudents([]);

      try {
        const { data: results, error: resultsError } = await supabase
          .from("field_results")
          .select("student_id, distance, no_result")
          .eq("field_id", fieldId);

        if (resultsError) throw resultsError;

        const resultsMap = {};
        const noResultMap = {};

        results.forEach((result) => {
          resultsMap[result.student_id] = result.distance;
          noResultMap[result.student_id] = !!result.no_result;
        });

        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("student_id, first_name, last_name")
          .eq("grade", grade)
          .eq("sex", gender);

        if (studentsError) throw studentsError;

        setDistances((prev) => ({
          ...prev,
          [fieldId]: {
            ...resultsMap,
            ...prev[fieldId],
          },
        }));

        setNoResult((prev) => ({
          ...prev,
          [fieldId]: {
            ...noResultMap,
            ...prev[fieldId],
          },
        }));

        setLockedInputs((prev) => ({
          ...prev,
          [fieldId]: Object.fromEntries(
            Object.keys(resultsMap).map((id) => [id, true])
          ),
        }));

        const merged = studentsData.map((student) => ({
          ...student,
          existingResult: resultsMap[student.student_id] ?? null,
        }));

        setStudents(merged);
      } catch (error) {
        console.error("Error loading field students:", error);
        setStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    };

    fetchStudents();
  }, [fieldId, grade, gender]);

  const handleSetDistance = (studentId) => {
    if (savingStudents[studentId]) return;

    const no_result = !!noResult[fieldId]?.[studentId];

    let distance = null;

    if (!no_result) {
      const rawValue = distances[fieldId]?.[studentId];

      distance = parseFloat(
        String(rawValue ?? "").trim().replace(",", ".")
      );

      if (!Number.isFinite(distance) || distance < 0) {
        alert("Enter a valid number");
        return;
      }
    }

    setSavingStudents((prev) => ({
      ...prev,
      [studentId]: true,
    }));

    socket.emit(
      "save-field-result",
      {
        fieldId,
        studentId,
        distance,
        noResult: no_result,
      },
      (response) => {
        setSavingStudents((prev) => ({
          ...prev,
          [studentId]: false,
        }));

        if (!response?.success) {
          console.error(response?.message);
          alert(response?.message || "Unable to save field result");
          return;
        }

        setLockedInputs((prev) => ({
          ...prev,
          [fieldId]: {
            ...prev[fieldId],
            [studentId]: true,
          },
        }));
      }
    );
  };

  const handleEventType = (target) => {
    setEventType(target);
    setStudents([]);
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
        onChange={(e) => {
          setGrade(e.target.value);
          setStudents([]);
        }}
      >
        <option value="">Select Grade</option>

        {[
          "G1",
          "G2",
          "G3",
          "G4",
          "G5",
          "G6",
          "G7",
          "G8",
          "G9",
          "G10",
          "G11",
          "G12",
        ].map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      <select
        value={gender}
        onChange={(e) => {
          setGender(e.target.value);
          setStudents([]);
        }}
      >
        <option value="">Select Gender</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>

      {eventLoading && <p>Loading event...</p>}

      {!eventLoading && fieldId && studentsLoading && (
        <p>Loading students...</p>
      )}

      {!eventLoading &&
        !studentsLoading &&
        eventType &&
        grade &&
        gender &&
        fieldId &&
        students.length === 0 && (
          <p>No students available.</p>
        )}

      {!eventLoading && !studentsLoading && students.length > 0 && (
        <div>
          <h3>Enter Distances</h3>

          <div className="entries">
            {students.map((student) => {
              const studentId = student.student_id;
              const isLocked =
                !!lockedInputs[fieldId]?.[studentId];
              const isNoResult =
                !!noResult[fieldId]?.[studentId];
              const isSaving =
                !!savingStudents[studentId];

              return (
                <div key={studentId}>
                  <span>
                    {student.first_name} {student.last_name}
                  </span>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      distances[fieldId]?.[studentId] ?? ""
                    }
                    readOnly={
                      isLocked ||
                      isNoResult ||
                      isSaving
                    }
                    onChange={(e) =>
                      setDistances((prev) => ({
                        ...prev,
                        [fieldId]: {
                          ...prev[fieldId],
                          [studentId]: e.target.value,
                        },
                      }))
                    }
                  />

                  <label>
                    <input
                      type="checkbox"
                      checked={isNoResult}
                      disabled={isLocked || isSaving}
                      onChange={(e) =>
                        setNoResult((prev) => ({
                          ...prev,
                          [fieldId]: {
                            ...prev[fieldId],
                            [studentId]: e.target.checked,
                          },
                        }))
                      }
                    />{" "}
                    No Result
                  </label>

                  {!isLocked && (
                    <button
                      onClick={() =>
                        handleSetDistance(studentId)
                      }
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Set"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}