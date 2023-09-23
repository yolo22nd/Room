package com.company.RoomsNDoors;

import com.company.Base;
import com.company.You;

public class Door2 extends Base {
    public String object = "Door";
    public static String name = "a Door";
    public static boolean locked =false;
    public static int sectorPosition;
    public static int position=-10;
    public void setPosition(int sectorPosition) {
        Door2.sectorPosition = sectorPosition;
        position =32;
    }

    public static boolean doorOpen2 = false;

    public static boolean getLocked(){
        setLocked();
        return locked;
    }

    public static void setLocked(){
        locked=true;
        if (Hell.position!=11){
            Door4.locked=false;
        }
        if (You.haveHellKeys){
            locked=false;
        }
        if (doorOpen2){
            locked=false;
        }
    }

    public static void openDoor() {
        if (getLocked()==false) {
            if (doorOpen2) {
                System.out.println("the door is already Open");
            } else {
                doorOpen2 = true;
                System.out.println("you opened the door");
            }
        }else if(You.haveShowKeys){
            System.out.println("you tried the key but it did not fit.\n" +
                    "maybe it goes into something else.");
        }else{
            System.out.println("the door is locked\n" +
                    "you don't have its key");
        }
    }

    public static void closeDoor() {
            if (!doorOpen2) {
                System.out.println("the door is already closed");
            } else {
                doorOpen2 = false;
                System.out.println("you closed the door");
            }

    }
    @Override
    public void printMap(int sectorPosition) {
        Base.SectorPositionDoor2=sectorPosition;
        setPosition(sectorPosition);
        setHere(object,position);
        super.printMap(position);
        if(getLocked()) {
            System.out.println("it appears to be locked");
        }
    }
}
