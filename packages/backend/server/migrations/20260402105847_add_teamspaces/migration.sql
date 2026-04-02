-- CreateEnum
CREATE TYPE "TeamspaceVisibility" AS ENUM ('Open', 'Closed', 'Private');

-- CreateTable
CREATE TABLE "teamspaces" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "icon" VARCHAR,
    "visibility" "TeamspaceVisibility" NOT NULL DEFAULT 'Open',
    "defaultDocRole" SMALLINT NOT NULL DEFAULT 30,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teamspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teamspace_user_roles" (
    "teamspace_id" VARCHAR NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "role" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teamspace_user_roles_pkey" PRIMARY KEY ("teamspace_id","user_id")
);

-- CreateTable
CREATE TABLE "teamspace_docs" (
    "teamspace_id" VARCHAR NOT NULL,
    "doc_id" VARCHAR NOT NULL,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teamspace_docs_pkey" PRIMARY KEY ("teamspace_id","doc_id")
);

-- CreateIndex
CREATE INDEX "teamspaces_workspace_id_idx" ON "teamspaces"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "teamspaces_workspace_id_name_key" ON "teamspaces"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "teamspace_user_roles_user_id_idx" ON "teamspace_user_roles"("user_id");

-- CreateIndex
CREATE INDEX "teamspace_docs_doc_id_idx" ON "teamspace_docs"("doc_id");

-- AddForeignKey
ALTER TABLE "teamspaces" ADD CONSTRAINT "teamspaces_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teamspace_user_roles" ADD CONSTRAINT "teamspace_user_roles_teamspace_id_fkey" FOREIGN KEY ("teamspace_id") REFERENCES "teamspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teamspace_user_roles" ADD CONSTRAINT "teamspace_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teamspace_docs" ADD CONSTRAINT "teamspace_docs_teamspace_id_fkey" FOREIGN KEY ("teamspace_id") REFERENCES "teamspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
