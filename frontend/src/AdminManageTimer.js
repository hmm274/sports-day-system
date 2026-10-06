import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import Timer from "./Timer";

const AdminManageTimer = ({
  handleStart,
  handleStop,
  handleSave,
  socket,
}) => {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [laneStudents, setLaneStudents] = useState([]);
  const [timers, setTimers] = useState({});
  const [noResult, setNoResult] = useState({});
  const [raceStatus, setRaceStatus] = useState("idle");
  const [, setActiveTimers] = useState(0);

  const [racesLoading, setRacesLoading] = useState(true);
  const [lanesLoading, setLanesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onStartAll = () => {
    handleStart();
    setRaceStatus("running");
    setActiveTimers(laneStudents.filter(Boolean).length);
  };

  const onStopAll = () => {
    handleStop();
    setActiveTimers(0);
    setRaceStatus("finished");
  };

  const onReset = async () => {
    if (saving) return;

    setSaving(true);

    try {
      handleStop();

      await handleSave(
        selectedRaceId,
        timers,
        fetchRaces,
        fetchLaneStudents,
        noResult
      );

      setTimers({});
      setNoResult({});
      setActiveTimers(0);
      setRaceStatus("idle");
      setSelectedRaceId(null);

      socket.emit("clear-students");
    } catch (error) {
      console.error("Error saving race:", error);
    } finally {
      setSaving(false);
    }
  };

  const fetchRaces = async () => {
    setRacesLoading(true);

    try {
      const { data: raceData, error: raceError } = await supabase
        .from("races")
        .select("*")
        .order("race_id", { ascending: true });

      if (raceError) {
        console.error("Error fetching races:", raceError);
        return;
      }

      const racesWithNames = await Promise.all(
        raceData.map(async (race) => {
          const { data: resultsData, error: resultsError } =
            await supabase
              .from("race_results")
              .select(`
                student:student_id (
                  first_name
                )
              `)
              .is("time", null)
              .eq("race_id", race.race_id);

          if (resultsError) {
            console.error(
              "Error fetching race results:",
              resultsError
            );
            return {
              ...race,
              studentNames: "",
            };
          }

          const names =
            resultsData
              ?.map((r) => r.student.first_name)
              .join(", ") || "";

          return {
            ...race,
            studentNames: names,
          };
        })
      );

      setRaces(
        racesWithNames.filter(
          (race) => race.studentNames !== ""
        )
      );
    } finally {
      setRacesLoading(false);
    }
  };

  useEffect(() => {
    fetchRaces();
  }, []);

  const fetchLaneStudents = useCallback(async () => {
    if (!selectedRaceId) {
      setLaneStudents([]);
      return;
    }

    setLanesLoading(true);

    try {
      const { data, error } = await supabase
        .from("race_results")
        .select(`
          lane,
          student:student_id (
            student_id,
            first_name,
            last_name,
            house
          )
        `)
        .eq("race_id", selectedRaceId)
        .is("time", null)
        .order("lane", { ascending: true });

      if (error) {
        console.error(
          "Error fetching lane students:",
          error
        );

        setLaneStudents([]);
      } else {
        const lanes = Array(8).fill(null);

        data.forEach((entry) => {
          lanes[entry.lane - 1] = entry.student;
        });

        setLaneStudents(lanes);
        socket.emit("assign-students", lanes);
      }
    } finally {
      setLanesLoading(false);
    }
  }, [selectedRaceId, socket]);

  useEffect(() => {
    fetchLaneStudents();
  }, [fetchLaneStudents]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Manage Timers</h2>

      <div style={{ marginBottom: "15px" }}>
        <label>Select Race: </label>

        <select
          value={selectedRaceId || ""}
          onChange={(e) =>
            setSelectedRaceId(e.target.value)
          }
          disabled={racesLoading || saving}
        >
          <option value="">
            {racesLoading
              ? "Loading races..."
              : "-- Select Race --"}
          </option>

          {races.map((race) => (
            <option
              key={race.race_id}
              value={race.race_id}
            >
              {race.race_event} ({race.studentNames})
            </option>
          ))}
        </select>
      </div>

      {lanesLoading && <p>Loading participants...</p>}

      <div className="timer-options">
        <button
          onClick={onStartAll}
          disabled={
            !selectedRaceId ||
            raceStatus !== "idle" ||
            lanesLoading ||
            saving
          }
        >
          Start All
        </button>

        <button
          onClick={onStopAll}
          disabled={
            !selectedRaceId ||
            raceStatus !== "running" ||
            saving
          }
        >
          Stop All
        </button>

        <button
          onClick={onReset}
          disabled={
            !selectedRaceId ||
            raceStatus === "running" ||
            raceStatus === "idle" ||
            saving
          }
        >
          {saving ? "Saving..." : "Reset / Save"}
        </button>
      </div>

      <div className="timers">
        {[...Array(8)].map((_, i) => {
          const student = laneStudents[i];
          const laneId = i + 1;
          const laneTimer = timers[laneId];

          return (
            <div
              key={i}
              style={{ marginBottom: "20px" }}
            >
              {student && (
                <label>
                  <input
                    type="checkbox"
                    checked={!!noResult[laneId]}
                    disabled={saving}
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
                selectedRaceId={
                  selectedRaceId == null
                    ? null
                    : selectedRaceId
                }
                studentId={
                  student?.student_id || null
                }
                studentName={
                  student?.first_name || null
                }
                studentHouse={
                  student?.house || null
                }
                onStop={(lane, time) => {
                  setTimers((prev) => ({
                    ...prev,
                    [lane]: {
                      studentId:
                        student?.student_id,
                      time,
                    },
                  }));

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

              {laneTimer &&
                selectedRaceId != null && (
                  <p
                    style={{
                      fontWeight: "bold",
                      marginTop: "5px",
                    }}
                  >
                    Saved Time:{" "}
                    {laneTimer.time.toFixed(3)}s
                  </p>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminManageTimer;