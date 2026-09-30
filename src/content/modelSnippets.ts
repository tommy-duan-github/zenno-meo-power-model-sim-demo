export interface ModelSnippet { order:number;block:'Inputs'|'Orbit & environment'|'Power gain'|'Power used'|'Energy balance & battery'|'Design loops'|'Outputs';file:string;name:string;mirrors:string;summary:string;formula?:string;code:string; }
export const pipelineSnippet=`def run_scenario(config):
    cfg = apply_case(config)
    env = orbit_and_sun_geometry(cfg)
    env = magnetic_field(env, cfg)
    env = ground_contact(env, cfg)
    p_gen = solar_array_power(env, cfg)
    torquer = torquer_power(env, cfg)
    loads = schedule_all_loads(env, torquer, cfg)
    battery = simulate_battery(p_gen, loads, env, cfg)
    return plots_and_margins(env, p_gen, loads, battery, cfg)`;
export const modelSnippets:ModelSnippet[]=[
{order:1,block:'Inputs',file:'config.py',name:'apply_case',mirrors:'config.applyCase',summary:'Apply life case and stacked worst-case conditions.',formula:'worst case → β = 0°, S = 1322 W/m², EOL, storm field',code:`def apply_case(cfg):
    cfg = copy(cfg)
    if cfg.worst_case:
        cfg.beta_deg = 0
        cfg.flux = "aphelion"
        cfg.life_case = "EOL"
        cfg.field_scale = cfg.storm_scale
    return cfg`},
{order:2,block:'Orbit & environment',file:'environment.py',name:'orbit_and_sun_geometry',mirrors:'environment.orbitAndSunGeometry',summary:'Propagate a circular orbit against a fixed sun angle.',formula:'T = 2π√(r³/μ); eclipse if r·s < 0 and |r − (r·s)s| < R_E',code:`def orbit_and_sun_geometry(cfg):
    radius = R_E + cfg.altitude
    period = 2*pi*sqrt(radius**3 / MU_E)
    u = 2*pi*time_grid(cfg) / period
    position = circular_orbit(radius, u, cfg.inclination)
    sun = sun_vector_from_beta(cfg.beta)
    eclipse = (dot(position, sun) < 0) & (shadow_distance(position, sun) < R_E)
    return position, sun, eclipse, period`},
{order:3,block:'Orbit & environment',file:'environment.py',name:'magnetic_field',mirrors:'environment.magneticField',summary:'Estimate the quiet-time field along the orbit.',formula:'B = −B₀(R_E/r)³[3(ẑ·r̂)r̂ − ẑ]·fieldScale',code:`def magnetic_field(env, cfg):
    r_hat = unit(env.position)
    scale = -B_EQUATOR * (R_E / norm(env.position))**3
    b_vec = scale * (3 * dot(Z_AXIS, r_hat) * r_hat - Z_AXIS)
    return b_vec * cfg.field_scale`},
{order:4,block:'Orbit & environment',file:'environment.py',name:'ground_contact',mirrors:'environment.groundContact',summary:'Test station elevation while Earth rotates.',formula:'elevation = asin(ρ̂·R̂_station)',code:`def ground_contact(env, cfg):
    visible = []
    for station in cfg.stations:
        station_eci = rotate_ecef(station, OMEGA_EARTH * env.time)
        rho = env.position - station_eci
        elevation = asin(dot(unit(rho), unit(station_eci)))
        visible.append(elevation >= cfg.elevation_mask)
    return any_visible(visible)`},
{order:5,block:'Power gain',file:'power_gain.py',name:'solar_array_power',mirrors:'powerGain.solarArrayPower',summary:'Apply area, cell efficiency, degradation, path losses and pointing.',formula:'P_gen = A·η_cell·f_EOL·η_path·S·cosθ',code:`def solar_array_power(env, cfg):
    degradation = cfg.eol_factor if cfg.life_case == "EOL" else 1
    eta = cfg.cell_efficiency * degradation * cfg.path_efficiency
    incidence = array_incidence(env, cfg.tracking)
    return cfg.array_area * eta * cfg.solar_flux * incidence * ~env.eclipse`},
{order:6,block:'Power used',file:'power_used.py',name:'payload_power',mirrors:'powerUsed.payloadPower',summary:'Schedule payload active and standby modes.',formula:'P = P_on during duty window; P_standby otherwise',code:`def payload_power(env, cfg):
    if not cfg.payload_enabled:
        return zeros(env.steps)
    active = duty_windows(env, cfg.payload_duty, cfg.payload_schedule)
    return where(active, cfg.payload_on_w, cfg.payload_standby_w)`},
{order:7,block:'Power used',file:'power_used.py',name:'adcs_power',mirrors:'powerUsed.adcsPower',summary:'Keep attitude control mostly on.',formula:'P_ADCS = P_nominal·duty',code:`def adcs_power(env, cfg):
    if not cfg.adcs_enabled:
        return zeros(env.steps)
    return full(env.steps, cfg.adcs_w * cfg.adcs_duty)`},
{order:8,block:'Power used',file:'power_used.py',name:'comms_power',mirrors:'powerUsed.commsPower',summary:'Transmit only during ground-contact windows.',formula:'P_comms = P_tx in contact, P_standby otherwise',code:`def comms_power(env, cfg):
    if not cfg.comms_enabled:
        return zeros(env.steps)
    return where(env.contact, cfg.tx_w, cfg.standby_w)`},
{order:9,block:'Power used',file:'power_used.py',name:'thermal_power',mirrors:'powerUsed.thermalPower',summary:'Raise heater load in eclipse.',formula:'P_thermal = P_eclipse or P_sun',code:`def thermal_power(env, cfg):
    if not cfg.thermal_enabled:
        return zeros(env.steps)
    return where(env.eclipse, cfg.heater_eclipse_w, cfg.heater_sun_w)`},
{order:10,block:'Power used',file:'power_used.py',name:'torquer_power',mirrors:'powerUsed.torquerPower',summary:'Accumulate SRP momentum and dump it in a permitted window.',formula:'ΔH = Στ_SRP·Δt; τ_avail = k_eff·m·|B|; t_on ≈ ΔH/τ_avail',code:`def torquer_power(env, cfg):
    tau_srp = cfg.solar_flux / C * cfg.srp_area * (1 + cfg.q) * cfg.cp_offset
    dH = sum(tau_srp * env.sunlit * env.dt)
    torque = cfg.k_eff * cfg.dipole * env.b_magnitude
    window = env.sunlit if cfg.sunlight_dump_only else all_steps
    on = first_steps_until(sum(torque[window] * env.dt) >= dH)
    return cfg.driver_w * on, on, on.sum() * env.dt`},
{order:11,block:'Power used',file:'power_used.py',name:'cryocooler_power',mirrors:'powerUsed.cryocoolerPower',summary:'Compare steady cooling with pre-cool and on-demand operation.',formula:'choose min(E_always, E_onDemand) in auto mode',code:`def cryocooler_power(env, torquer_on, cfg):
    always = full(env.steps, cfg.cooler_steady_w)
    demand = full(env.steps, cfg.cooler_idle_w)
    for dump_start in rising_edges(torquer_on):
        demand[dump_start - cfg.precool_steps:dump_start] = cfg.cooldown_w
    demand[torquer_on] = cfg.cooler_steady_w
    mode = min_energy(always, demand) if cfg.mode == "auto" else cfg.mode
    return demand if mode == "onDemand" else always`},
{order:12,block:'Energy balance & battery',file:'battery.py',name:'simulate_battery',mirrors:'battery.simulateBattery',summary:'Carry stored energy forward and shed optional loads at low SoC.',formula:'E_next = clamp(E + η_c·P_charge·Δt − P_discharge·Δt/η_d, 0, C)',code:`def simulate_battery(p_gen, loads, env, cfg):
    energy = cfg.initial_soc * cfg.capacity_wh
    for k in range(env.steps):
        loads_k = apply_load_shedding(loads[k], energy / cfg.capacity_wh)
        net = p_gen[k] - sum(loads_k)
        if net >= 0:
            energy += min(net, cfg.max_charge_c * cfg.capacity_wh) * cfg.eta_c * env.dt_h
        else:
            energy += net / cfg.eta_d * env.dt_h
        energy = clamp(energy, 0, cfg.capacity_wh)
        soc[k] = energy / cfg.capacity_wh
    return soc`},
{order:13,block:'Energy balance & battery',file:'battery.py',name:'depth_of_discharge',mirrors:'battery.depthOfDischarge',summary:'Measure minimum state of charge in the last orbit.',formula:'DoD = 1 − min(SoC_lastOrbit)',code:`def depth_of_discharge(soc, env):
    last_orbit = soc[-env.steps_per_orbit:]
    dod = 1 - min(last_orbit)
    sustainable = soc[-1] >= soc[-env.steps_per_orbit-1] - tolerance
    return dod, sustainable`},
{order:14,block:'Design loops',file:'design_loops.py',name:'sizing_loop',mirrors:'designLoops.sizingLoop',summary:'Bisect area and capacity under worst-case conditions.',formula:'min A, C subject to margin ≥ target and DoD ≤ limit',code:`def sizing_loop(cfg):
    cfg = apply_worst_case(cfg)
    area = bisect(cfg.area_bounds, lambda a: run(cfg, area=a).margin >= cfg.target)
    capacity = bisect(cfg.capacity_bounds,
                      lambda c: run(cfg, area=area, capacity=c).dod <= cfg.dod_limit)
    return area, capacity, run(cfg, area=area, capacity=capacity)`},
{order:15,block:'Outputs',file:'outputs.py',name:'margins_and_monte_carlo',mirrors:'outputs.margins',summary:'Report orbit energy margin and sample uncertain inputs.',formula:'margin = (E_gen − E_load)/E_load',code:`def margins(env, p_gen, loads):
    e_gen = sum(p_gen[last_orbit]) * env.dt_h
    e_load = sum(loads[last_orbit]) * env.dt_h
    return (e_gen - e_load) / e_load

def monte_carlo(cfg, uncertainties, n, seed):
    rng = Random(seed)
    runs = [run(sample_inputs(cfg, uncertainties, rng)) for _ in range(n)]
    return percentile([r.dod for r in runs], [5, 50, 95])`}
];
