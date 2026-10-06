import React, { useState, useEffect } from "react";
import Timer from "./Timer";
import socket from "./socket";
import Admin from "./Admin";
import Races from "./Races";
import AdminManageTimer from "./AdminManageTimer";
import HousePoints from "./HousePoints";
import FieldManager from "./FieldManager";
import "./App.css";

function App() {
  const [role, setRole] = useState("");
  const [passcode, setPasscode] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [adminAction, setAdminAction] = useState("none");
  const [points, setPoints] = useState(false);
  const [studentInfo, setStudentInfo] = useState({
    name: null,
    house: null,
  });

  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = () => {
    if (loginLoading) return;

    if (!role) {
      alert("Please select a role");
      return;
    }

    if (!passcode) {
      alert("Please enter a passcode");
      return;
    }

    setLoginLoading(true);

    if (socket.disconnected) {
      socket.connect();
    }

    socket.emit(
      "request-role",
      {
        role,
        passcode,
      },
      (response) => {
        setLoginLoading(false);

        if (response?.success) {
          setAuthenticated(true);
          setPasscode("");
        } else {
          alert(response?.message || "Unable to log in");
        }
      }
    );
  };

  const handleStart = () => {
    socket.emit("start-timer");
  };

  const handleStop = () => {
    socket.emit("stop-all-timers");
  };

  const handleSave = (
    selectedRaceId,
    timers,
    fetchRaces,
    fetchLaneStudents,
    noResult
  ) => {
    return new Promise((resolve, reject) => {
      try {
        const results = Object.entries(timers).map(([lane, data]) => ({
          lane: parseInt(lane),
          student_id: data.studentId,
          time: data.time,
          no_result: !!noResult[lane],
        }));

        console.log("Sending results:", results);

        socket.emit(
          "save-race-results",
          {
            raceId: selectedRaceId,
            results,
          },
          async (response) => {
            if (!response?.success) {
              console.error(
                "Error saving results:",
                response?.message
              );

              alert(
                response?.message || "Failed to save results"
              );

              reject(
                new Error(
                  response?.message || "Failed to save results"
                )
              );

              return;
            }

            try {
              if (fetchRaces) {
                await fetchRaces();
              }

              if (fetchLaneStudents) {
                await fetchLaneStudents();
              }

              socket.emit("reset-all-timers");

              alert("Results saved!");

              resolve();
            } catch (error) {
              console.error(
                "Error refreshing race data:",
                error
              );

              reject(error);
            }
          }
        );
      } catch (error) {
        console.error(
          "Unexpected error saving results:",
          error
        );

        alert("Failed to save results");

        reject(error);
      }
    });
  };

  useEffect(() => {
    socket.on("assign-students", (laneStudents) => {
      const laneNum = parseInt(role.split("-")[1]);
      const assigned = laneStudents[laneNum - 1];

      if (assigned) {
        setStudentInfo({
          name: assigned.first_name,
          house: assigned.house,
        });
      }
    });

    socket.on("clear-students", () => {
      setStudentInfo({
        name: null,
        house: null,
      });
    });

    return () => {
      socket.off("assign-students");
      socket.off("clear-students");
    };
  }, [role]);

  const handleLogout = () => {
    socket.disconnect();
    setAuthenticated(false);
    setAdminAction("none");
    setPasscode("");
    setStudentInfo({
      name: null,
      house: null,
    });
  };

  const handleUndo = () => {
    setPoints(false);
    setAdminAction("none");
  };

  if (!authenticated) {
    if (points) {
      return (
        <div>
          <HousePoints />
          <button onClick={handleUndo}>Back</button>
        </div>
      );
    }

    return (
      <div className="Login">
        <div className="box">
          <h1>Sports Day</h1>

          <select
            value={role}
            disabled={loginLoading}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Select Role</option>
            <option value="admin">Admin</option>

            {[...Array(8)].map((_, i) => (
              <option
                key={i}
                value={`lane-${i + 1}`}
              >
                Lane {i + 1}
              </option>
            ))}
          </select>

          <br />

          <input
            type="password"
            placeholder="Passcode"
            value={passcode}
            disabled={loginLoading}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleLogin();
              }
            }}
          />

          <br />

          <button
            onClick={handleLogin}
            disabled={loginLoading}
          >
            {loginLoading ? "Logging in..." : "Login"}
          </button>

          <br />
          <br />

          <button
            onClick={() => setPoints(true)}
            disabled={loginLoading}
          >
            View House Points
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {role === "admin" ? (
        <div>
          {adminAction === "none" ? (
            <div>
              <div className="menu">
                <button
                  onClick={() => setAdminAction("set")}
                >
                  Set Races
                </button>

                <button
                  onClick={() => setAdminAction("manage")}
                >
                  Timer
                </button>

                <button
                  onClick={() => setAdminAction("field")}
                >
                  Field
                </button>
              </div>

              <Races />
            </div>
          ) : (
            <div>
              {adminAction === "set" ? (
                <div>
                  <Admin />
                </div>
              ) : (
                <div>
                  {adminAction === "field" ? (
                    <div>
                      <FieldManager />
                    </div>
                  ) : (
                    <div>
                      <AdminManageTimer
                        handleStart={handleStart}
                        handleStop={handleStop}
                        handleSave={handleSave}
                        socket={socket}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <Timer
          laneId={parseInt(role.split("-")[1])}
          socket={socket}
          isAdmin={false}
          studentName={studentInfo.name}
          studentHouse={studentInfo.house}
        />
      )}

      <div className="button-logout">
        {adminAction !== "none" && (
          <button
            className="button-logout-1"
            onClick={handleUndo}
          >
            Back
          </button>
        )}

        <button onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}

export default App;