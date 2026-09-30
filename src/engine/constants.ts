export const MU_EARTH = 398600.4418; // km³/s², WGS-84 / EGM96
export const R_EARTH = 6378.137; // km, WGS-84 equatorial
export const OMEGA_EARTH = 7.2921159e-5; // rad/s
export const C_LIGHT = 299792458; // m/s
export const B_EQUATOR = 29400e-9; // T, quiet-time aligned dipole approximation
export const SOLAR_FLUX = { mean: 1361, aphelion: 1322, perihelion: 1414 } as const; // W/m²
export const STATIONS = [
  { name: 'Awarua, NZ', latDeg: -46.53, lonDeg: 168.38 },
  { name: 'Svalbard', latDeg: 78.23, lonDeg: 15.39 },
] as const;
