import Listr from "listr";
import { apiV8, apiV9 } from "../api.js";
import { writeContext } from "../index.js";

export async function migrateUsers(context) {
	return new Listr([
		{
			title: "Downloading Roles",
			skip: context => context.completedSteps.roles === true,
			task: downloadRoles,
		},
		{
			title: "Creating Roles",
			skip: context => context.completedSteps.roles === true,
			task: createRoles,
		},
		{
      title: "Saving Roles context",
			skip: context => context.completedSteps.roles === true,
      task: () => writeContext(context, "roles"),
    },
		{
			title: "Downloading Users",
			skip: context => context.completedSteps.users === true,
			task: downloadUsers,
		},
		{
			title: "Creating Users",
			skip: context => context.completedSteps.users === true,
			task: createUsers,
		},
		{
      title: "Saving users context",
			skip: context => context.completedSteps.users === true,
			task: () => writeContext(context, "users"),
    },
	]);
}

async function downloadRoles(context) {
	const response = await apiV8.get("/roles");
	context.roles = response.data.data.filter((role) => {
		return role.id !== 2; // Role 2 was the hardcoded public role
	});
}

async function createRoles(context) {
	const rolesV9 = context.roles.map((role) => ({
		name: role.name,
		icon: "supervised_user_circle",
		description: role.description,
		ip_access: role.ip_whitelist,
		enforce_tfa: !!role.enforce_2fa,
		admin_access: role.id === 1, // 1 was hardcoded admin role
		app_access: true,
	}));

	const createdRoles = await apiV9.post("/roles", rolesV9, {
		params: { limit: -1 },
	});

	context.roleMap = {};

	let createdRolesAsArray = createdRoles.data.data;

	if (Array.isArray(createdRolesAsArray) === false)
		createdRolesAsArray = [createdRolesAsArray];

	context.roles.forEach((role, index) => {
		context.roleMap[role.id] = createdRolesAsArray[index].id;
	});

	context.roles = createdRolesAsArray;
}

async function downloadUsers(context) {
	const response = await apiV8.get("/users", {
		params: {
			limit: -1,
			status: '*',
		}
	});
	context.users = response.data.data;
}

async function createUsers(context) {
	const usersV9 = context.users.map((user) => ({
		first_name: user.first_name,
		last_name: user.last_name,
		email: user.email,
		title: user.title,
		description: user.description,
		// avatar: user.avatar, @TODO: files first
		language: user.locale,
		theme: user.theme,
		role: context.roleMap[user.role],
		token: user.token,
	}));

	const createdUsers = await apiV9.post("/users", usersV9, {
		params: { limit: -1 },
	});

	let createdUsersAsArray = createdUsers.data.data;

	if (Array.isArray(createdUsersAsArray) === false)
		createdUsersAsArray = [createdUsersAsArray];

	context.userMap = {};

	context.users.forEach((user, index) => {
		context.userMap[user.id] = createdUsersAsArray[index].id;
	});

	context.users = createdUsers.data.data;
}
