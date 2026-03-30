// TODO: Generate this file automatically from openapi.json (npm run generate-client)

export type DroneCreate = {
    name: string;
};

export type DronePublic = {
    id: string;
    name: string;
    secret_key: string;
    owner_id: string;
    created_at: string;
    updated_at: string;
    stream_url?: string | null;
};

export type UserPublic = {
    id: string;
    sub: string;
    issuer: string;
    email?: (string | null);
    username?: (string | null);
    first_name?: (string | null);
    last_name?: (string | null);
    is_admin: boolean;
    created_at: string;
    updated_at: string;
};

export type HTTPValidationError = {
    detail?: Array<ValidationError>;
};

export type ValidationError = {
    loc: Array<(string | number)>;
    msg: string;
    type: string;
    input?: unknown;
    ctx?: {
        [key: string]: unknown;
    };
};

export type Message = {
    message: string;
};

export type DronesListDronesResponse = Array<DronePublic>;

export type DronesCreateDroneData = {
    requestBody: DroneCreate;
};

export type DronesCreateDroneResponse = DronePublic;

export type DronesGetDroneData = {
    droneId: string;
};

export type DronesGetDroneResponse = DronePublic;

export type DronesDeleteDroneData = {
    droneId: string;
};

export type DronesDeleteDroneResponse = void;

export type UsersListUsersResponse = Array<UserPublic>;
