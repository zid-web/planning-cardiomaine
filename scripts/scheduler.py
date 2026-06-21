import sys
import random
from ortools.sat.python import cp_model

# Mock Data
DOCTORS = ["Dr. A", "Dr. B", "Dr. C", "Dr. D", "Dr. E"]
DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
SHIFTS = ["Matin", "Apm", "Garde"]

def solve_schedule(num_days=30):
    """
    Phase 1: Solve MIP/CP-SAT on the entire horizon.
    Minimizing inequity + penalties.
    """
    model = cp_model.CpModel()
    
    # Variables
    # shifts[(doctor, day, shift)]
    shifts = {}
    for d in DOCTOR:
        for day in range(num_days):
            for s in SHIFTS:
                shifts[(d, day, s)] = model.NewBoolVar(f'shift_d{d}_day{day}_s{s}')

    # Constraints
    
    # 1. Each shift must be covered by exactly one doctor (simplified)
    for day in range(num_days):
        for s in SHIFTS:
            model.Add(sum(shifts[(d, day, s)] for d in DOCTORS) == 1)

    # 2. A doctor can work at most one shift per day (simplified)
    for d in DOCTORS:
        for day in range(num_days):
            model.Add(sum(shifts[(d, day, s)] for s in SHIFTS) <= 1)

    # Objective: Minimize inequity (variance in total shifts)
    # This is hard in CP-SAT directly, so we minimize the difference between max and min shifts
    
    total_shifts = {}
    for d in DOCTORS:
        total_shifts[d] = sum(shifts[(d, day, s)] for day in range(num_days) for s in SHIFTS)
        
    min_shifts = model.NewIntVar(0, num_days, 'min_shifts')
    max_shifts = model.NewIntVar(0, num_days, 'max_shifts')
    
    for d in DOCTORS:
        model.Add(min_shifts <= total_shifts[d])
        model.Add(max_shifts >= total_shifts[d])
        
    model.Minimize(max_shifts - min_shifts)

    # Solve
    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        print("Solution found!")
        results = {}
        for day in range(num_days):
            results[day] = {}
            for s in SHIFTS:
                for d in DOCTORS:
                    if solver.Value(shifts[(d, day, s)]):
                        results[day][s] = d
        return results
    else:
        print("No solution found.")
        return None

def heuristic_optimization(current_schedule):
    """
    Phase 2: Local heuristic (greedy + simulated annealing) for swaps.
    """
    # Simplified Simulated Annealing
    print("Running Phase 2: Heuristic Optimization...")
    
    # In a real implementation, we would swap shifts to improve the score
    # Here we just return the current schedule as a placeholder
    return current_schedule

def fallback_schedule():
    """
    Fallback: Heuristic prioritizing minimal coverage + safety rules.
    """
    print("Running Fallback Strategy...")
    schedule = {}
    for day in range(30):
        schedule[day] = {}
        available_doctors = list(DOCTORS)
        random.shuffle(available_doctors)
        
        for s in SHIFTS:
            if available_doctors:
                schedule[day][s] = available_doctors.pop()
            else:
                schedule[day][s] = "UNASSIGNED"
    return schedule

if __name__ == "__main__":
    print("Starting Scheduler...")
    try:
        # Try Phase 1
        schedule = solve_schedule()
        if not schedule:
            # Try Phase 2 / Fallback
            schedule = fallback_schedule()
            
        # Apply Phase 2 Heuristics
        final_schedule = heuristic_optimization(schedule)
        
        print("Final Schedule Generated.")
        # In a real app, we would save this to a JSON file or database
        
    except Exception as e:
        print(f"Error: {e}")
        print("Using Fallback...")
        fallback_schedule()
