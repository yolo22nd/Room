package com.company.RoomsNDoors;

import com.company.Base;
import com.company.You;

public class Door3 extends Base {
    public String object = "Door";
    public static String name = "a Door";
    public static boolean locked =false;
    public static int sectorPosition;
    public static int position=-10;
    public void setPosition(int sectorPosition) {
        Door3.sectorPosition = sectorPosition;
        position=33;
    }

    public static boolean getLocked(){
        setLocked();
        return locked;
    }

    public static void setLocked(){
        locked=true;
        if (Hell.position!=15){
            Door4.locked=false;
        }
        if (You.haveHellKeys){
            locked=false;
        }
        if (doorOpen3){
            locked=false;
        }
    }

    public static boolean doorOpen3 = false;

    public static void openDoor() {
        if (getLocked()==false) {
            if (doorOpen3) {
                System.out.println("the door is already Open");
            } else {
                doorOpen3 = true;
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
            if (!doorOpen3) {
                System.out.println("the door is already closed");
            } else {
                doorOpen3 = false;
                System.out.println("you closed the door");
            }
    }
    @Override
    public void printMap(int sectorPosition) {
        Base.SectorPositionDoor3=sectorPosition;
        setPosition(sectorPosition);
        setHere(object,position);
        super.printMap(position);
        if(getLocked()) {
            System.out.println("it appears to be locked");
        }
    }
}
